import { CompositeLayer, SolidPolygonLayer, TextLayer } from "deck.gl";
import pMap from "p-map";

import { ColorPaletteExtension, XRLayer } from "@hms-dbmi/viv";
import type { SupportedTypedArray } from "@vivjs/types";
import type { CompositeLayerProps, PickingInfo, SolidPolygonLayerProps, TextLayerProps, Viewport } from "deck.gl";
import { Matrix4 } from "math.gl";
import type { ZarrPixelSource } from "../ZarrPixelSource";
import { assert } from "../utils";
import type { BaseLayerProps } from "./viv-layers";

/**
 * One cell of the grid, with every resolution level of its image, finest first.
 *
 * A plate holds a pyramid per well so the layer can trade resolution against how much of
 * the plate is on screen. A well holds a single level, as its images are shown whole.
 */
export interface GridLoader {
  sources: ZarrPixelSource[];
  row: number;
  col: number;
  name: string;
}

type Polygon = Array<[number, number]>;

export interface GridLayerProps
  extends Omit<CompositeLayerProps, "loaders" | "modelMatrix" | "opacity" | "onClick" | "id">,
    BaseLayerProps {
  loaders: GridLoader[];
  rows: number;
  columns: number;
  rowLabels?: string[];
  columnLabels?: string[];
  spacer?: number;
  text?: boolean;
  concurrency?: number;
}

/**
 * Coarsest acceptable sampling: at least one screen pixel per two data pixels. Scanning
 * levels finest-first, the first level to satisfy this is the sharpest one that is not
 * oversampled by more than 2x.
 */
const MIN_PIXELS_PER_DATA_PIXEL = 0.5;

/**
 * How long panning must settle before data is refetched. Deck reports a viewport change
 * per frame; without this, dragging across a plate queues a request per frame.
 */
const VIEWPORT_SETTLE_MS = 120;

/** Deck's bounds convention for XRLayer: y grows downwards, so `bottom` exceeds `top`. */
type DeckBounds = [left: number, bottom: number, right: number, top: number];

export type Bounds = { left: number; right: number; top: number; bottom: number };

export type Dimensions = { width: number; height: number };

type VisibleCell = {
  loader: GridLoader;
  cellBounds: Bounds;
  /** The part of the cell inside the viewport, in world coordinates. */
  visibleBounds: Bounds;
};

type GridContext = {
  /** Size of one cell in world units, taken from the finest level. */
  fullSize: Dimensions;
  spacer: number;
  visibleCells: VisibleCell[];
};

type GridDataEntry = GridLoader & {
  bounds: DeckBounds;
  dtype: ZarrPixelSource["dtype"];
  /** Shape of the region actually read, which is the window when one was applied. */
  data: { data: Array<SupportedTypedArray>; width: number; height: number };
};

type SharedLayerState = {
  gridData: GridDataEntry[];
  fullWidth: number;
  fullHeight: number;
  resolutionLevel: number;
  /**
   * Bookkeeping for work in progress.
   *
   * This has to live in `state` rather than in instance fields: deck.gl builds a new
   * layer instance on every render and transfers only `state` and `internalState`, so
   * a field would reset mid-flight — losing the timer to clear and the request to
   * abort, and resetting the counter that decides whether a response is still wanted.
   *
   * Mutated in place rather than through `setState`, as none of it is rendered.
   */
  requestId: number;
  inFlight: AbortController | null;
  settleTimer: ReturnType<typeof setTimeout> | null;
  /** What the in-flight request is fetching, or null when nothing is in flight. */
  inFlightKey: string | null;
  /** What the data currently on screen was fetched for. */
  renderedKey: string | null;
};

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
}

function sourceDimensions(source: ZarrPixelSource): Dimensions {
  const labels = source.labels as unknown as string[];
  const x = labels.indexOf("x");
  const y = labels.indexOf("y");
  assert(x !== -1 && y !== -1, "Expected a pixel source with x and y axes.");
  return { width: source.shape[x], height: source.shape[y] };
}

export function cellBoundsFor(loader: GridLoader, { width, height }: Dimensions, spacer: number): Bounds {
  const left = loader.col * (width + spacer);
  const top = loader.row * (height + spacer);
  return { left, top, right: left + width, bottom: top + height };
}

function toDeckBounds(bounds: Bounds): DeckBounds {
  return [bounds.left, bounds.bottom, bounds.right, bounds.top];
}

export function intersect(a: Bounds, b: Bounds): Bounds | null {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  return right <= left || bottom <= top ? null : { left, right, top, bottom };
}

/**
 * The viewport in the grid's own coordinates.
 *
 * The layer is drawn through `modelMatrix`, so the viewport corners are brought back
 * through its inverse before being compared with cell bounds.
 */
function viewportBoundsIn(viewport: Viewport, modelMatrix?: Matrix4): Bounds {
  const corners = [
    viewport.unproject([0, 0, 0]),
    viewport.unproject([viewport.width, 0, 0]),
    viewport.unproject([viewport.width, viewport.height, 0]),
    viewport.unproject([0, viewport.height, 0]),
  ];
  // A singular matrix would mean nothing is visible anyway; culling against the
  // untransformed corners at least keeps the grid on screen.
  const inverse = modelMatrix ? invertOrNull(modelMatrix) : null;
  const points = inverse ? corners.map((corner) => inverse.transformAsPoint(corner)) : corners;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function invertOrNull(matrix: Matrix4): Matrix4 | null {
  try {
    return new Matrix4(matrix).invert();
  } catch {
    return null;
  }
}

/**
 * The window of `levelSize` covering `visibleBounds`, and the world bounds it maps back
 * to. Returns no window when the whole cell is visible, so the common fully-zoomed-out
 * case reads the array exactly as it did before.
 */
export function windowForLevel(options: {
  visibleBounds: Bounds;
  cellBounds: Bounds;
  fullSize: Dimensions;
  levelSize: Dimensions;
}): { window?: { x: [number, number]; y: [number, number] }; renderBounds: Bounds } {
  const { visibleBounds, cellBounds, fullSize, levelSize } = options;
  if (levelSize.width === 0 || levelSize.height === 0) {
    return { renderBounds: cellBounds };
  }
  // World units per data pixel at this level.
  const pixelWidth = fullSize.width / levelSize.width;
  const pixelHeight = fullSize.height / levelSize.height;

  const localLeft = clamp(visibleBounds.left - cellBounds.left, 0, fullSize.width);
  const localRight = clamp(visibleBounds.right - cellBounds.left, 0, fullSize.width);
  const localTop = clamp(visibleBounds.top - cellBounds.top, 0, fullSize.height);
  const localBottom = clamp(visibleBounds.bottom - cellBounds.top, 0, fullSize.height);

  const xStart = Math.max(0, Math.floor(localLeft / pixelWidth));
  const xStop = Math.min(levelSize.width, Math.max(xStart + 1, Math.ceil(localRight / pixelWidth)));
  const yStart = Math.max(0, Math.floor(localTop / pixelHeight));
  const yStop = Math.min(levelSize.height, Math.max(yStart + 1, Math.ceil(localBottom / pixelHeight)));

  if (xStart === 0 && yStart === 0 && xStop === levelSize.width && yStop === levelSize.height) {
    return { renderBounds: cellBounds };
  }
  return {
    window: { x: [xStart, xStop], y: [yStart, yStop] },
    // Snap back to pixel edges, so the texture lands exactly on the data it came from.
    renderBounds: {
      left: cellBounds.left + xStart * pixelWidth,
      right: cellBounds.left + xStop * pixelWidth,
      top: cellBounds.top + yStart * pixelHeight,
      bottom: cellBounds.top + yStop * pixelHeight,
    },
  };
}

/**
 * The level to draw, given each level's size and how large a cell is on screen.
 *
 * Levels run finest first, so the first one that clears the sampling threshold is the
 * sharpest affordable choice; if none does, the viewport is small enough that even the
 * coarsest level is oversampled, and that is what gets drawn.
 */
export function pickLevelForScreenSize(levelSizes: Dimensions[], screen: Dimensions): number {
  for (let level = 0; level < levelSizes.length; level++) {
    const { width, height } = levelSizes[level];
    if (width === 0 || height === 0) continue;
    if (Math.min(screen.width / width, screen.height / height) >= MIN_PIXELS_PER_DATA_PIXEL) {
      return level;
    }
  }
  return Math.max(0, levelSizes.length - 1);
}

/**
 * Identifies the data a refresh would fetch.
 *
 * Deck reports a viewport change for things that do not move the grid — the first frame,
 * a resize, a device pixel ratio change — and each one used to abort the request in
 * flight and start the same one again. On a plate that is a few hundred requests thrown
 * away, and on first load it meant the initial paint was repeatedly cancelled and
 * restarted. Bounds are rounded because only whole pixels are ever read.
 */
function requestKey(context: GridContext, level: number, selections: number[][]): string {
  const cells = context.visibleCells
    .map(({ loader, visibleBounds: b }) => {
      const box = [b.left, b.top, b.right, b.bottom].map(Math.round).join(",");
      return `${loader.row},${loader.col}:${box}`;
    })
    .join(";");
  return `${level}|${JSON.stringify(selections)}|${cells}`;
}

function buildGridContext(props: GridLayerProps, viewport?: Viewport): GridContext | null {
  const { loaders, spacer = 0 } = props;
  const base = loaders.find((loader) => loader.sources.length > 0);
  if (!base) {
    return null;
  }
  const fullSize = sourceDimensions(base.sources[0]);
  if (fullSize.width === 0 || fullSize.height === 0) {
    return null;
  }
  const populated = loaders.filter((loader) => loader.sources.length > 0);
  // Without a viewport (the first render) nothing can be culled, so take every cell.
  const bounds = viewport ? viewportBoundsIn(viewport, props.modelMatrix) : null;
  const visibleCells: VisibleCell[] = [];
  for (const loader of populated) {
    const cellBounds = cellBoundsFor(loader, fullSize, spacer);
    const visibleBounds = bounds ? intersect(cellBounds, bounds) : cellBounds;
    if (visibleBounds) {
      visibleCells.push({ loader, cellBounds, visibleBounds });
    }
  }
  return { fullSize, spacer, visibleCells };
}

async function loadCell(
  cell: VisibleCell,
  level: number,
  selections: number[][],
  fullSize: Dimensions,
  signal: AbortSignal,
): Promise<GridDataEntry> {
  const { loader } = cell;
  // Levels are shared across a plate but a cell may be shallower; clamp rather than fail.
  const source = loader.sources[Math.min(level, loader.sources.length - 1)];
  const { window, renderBounds } = windowForLevel({
    visibleBounds: cell.visibleBounds,
    cellBounds: cell.cellBounds,
    fullSize,
    levelSize: sourceDimensions(source),
  });
  const tiles = await Promise.all(selections.map((selection) => source.getRaster({ selection, window, signal })));
  const [first] = tiles;
  return {
    ...loader,
    bounds: toDeckBounds(renderBounds),
    dtype: source.dtype,
    data: {
      data: tiles.map((tile) => tile.data) as Array<SupportedTypedArray>,
      width: first?.width ?? 0,
      height: first?.height ?? 0,
    },
  };
}

function loadVisibleCells(
  context: GridContext,
  level: number,
  selections: number[][],
  concurrency: number | undefined,
  signal: AbortSignal,
): Promise<GridDataEntry[]> {
  if (context.visibleCells.length === 0) {
    return Promise.resolve([]);
  }
  // There are `selections.length` requests per cell; scale the budget to match.
  const perCell =
    concurrency && selections.length > 0 ? Math.max(1, Math.ceil(concurrency / selections.length)) : concurrency;
  return pMap(context.visibleCells, (cell) => loadCell(cell, level, selections, context.fullSize, signal), {
    concurrency: perCell,
  });
}

class GridLayer extends CompositeLayer<CompositeLayerProps & GridLayerProps> {
  static layerName = "VizarrGridLayer";
  static defaultProps = {
    // @ts-expect-error - XRLayer props are not typed
    ...XRLayer.defaultProps,
    // Special grid props
    loaders: { type: "array", value: [], compare: true },
    spacer: { type: "number", value: 5, compare: true },
    rows: { type: "number", value: 0, compare: true },
    columns: { type: "number", value: 0, compare: true },
    concurrency: { type: "number", value: 10, compare: false }, // set concurrency for queue
    text: { type: "boolean", value: false, compare: true },
    // Deck.gl
    onClick: { type: "function", value: null, compare: true },
    onHover: { type: "function", value: null, compare: true },
  };

  get #state(): SharedLayerState {
    // @ts-expect-error - typed as any by deck
    return this.state;
  }

  set #state(state: SharedLayerState) {
    this.state = state;
  }

  initializeState() {
    const context = buildGridContext(this.props, this.context.viewport);
    // Start at the coarsest level: it is the cheapest thing to show while the real
    // level is being chosen, and matches what the plate used to load.
    const level = this.#coarsestLevel(this.props.loaders);
    this.#state = {
      gridData: [],
      fullWidth: context?.fullSize.width ?? 0,
      fullHeight: context?.fullSize.height ?? 0,
      resolutionLevel: level,
      requestId: 0,
      inFlight: null,
      settleTimer: null,
      inFlightKey: null,
      renderedKey: null,
    };
    if (context) {
      this.#refresh(this.props, level, context);
    }
  }

  finalizeState() {
    this.#cancelPending();
  }

  // biome-ignore lint/suspicious/noExplicitAny: deck.gl does not narrow these for us
  shouldUpdateState({ changeFlags }: any) {
    return Boolean(changeFlags.viewportChanged || changeFlags.propsChanged || changeFlags.dataChanged);
  }

  updateState({
    props,
    oldProps,
    changeFlags,
  }: {
    props: GridLayerProps;
    oldProps: GridLayerProps;
    changeFlags: {
      propsChanged: string | boolean | null;
      viewportChanged?: boolean;
    };
  }) {
    const { propsChanged } = changeFlags;
    const loaderChanged = typeof propsChanged === "string" && propsChanged.includes("props.loaders");
    const selectionsChanged = props.selections !== oldProps.selections;

    if (loaderChanged || selectionsChanged) {
      const context = buildGridContext(props, this.context.viewport);
      const level = loaderChanged ? this.#coarsestLevel(props.loaders) : this.#state.resolutionLevel;
      this.setState({
        fullWidth: context?.fullSize.width ?? 0,
        fullHeight: context?.fullSize.height ?? 0,
        resolutionLevel: level,
      });
      this.#refresh(props, level, context);
      return;
    }

    if (changeFlags.viewportChanged) {
      // Coalesce: a drag reports a change per frame, and only where it stops matters.
      this.#scheduleRefresh(props);
    }
  }

  getPickingInfo({ info }: { info: PickingInfo }) {
    // provide Grid row and column info for mouse events (hover & click)
    if (!info.coordinate) {
      return info;
    }
    const spacer = this.props.spacer || 0;
    const { fullWidth, fullHeight } = this.#state;
    if (fullWidth === 0 || fullHeight === 0) {
      return info;
    }
    const [x, y] = info.coordinate;
    const row = Math.floor(y / (fullHeight + spacer));
    const column = Math.floor(x / (fullWidth + spacer));
    const { rows, columns, rowLabels, columnLabels } = this.props;
    if (row < 0 || column < 0 || row >= rows || column >= columns) {
      return info;
    }
    // A grid position can be empty: a plate need not have an image in every well.
    // Reported so the tooltip can say so rather than naming a cell that is not there.
    // deck.gl's own `loaders` prop shadows ours in the intersection type the class is
    // declared with, so this one spot needs to say which it means.
    const gridLoaders = this.props.loaders as unknown as GridLoader[];
    const cell = gridLoaders.find((loader) => loader.row === row && loader.col === column);
    return {
      ...info,
      gridCoord: { row, column },
      gridLabels: {
        row: rowLabels?.[row],
        column: columnLabels?.[column],
      },
      /** The cell under the pointer, or null where the grid has no image. */
      gridCell: cell ? { name: cell.name } : null,
      /** The source this grid was built from; `layerProps.id` carries it. */
      gridSourceId: this.props.id,
    };
  }

  renderLayers() {
    const { gridData, fullWidth, fullHeight } = this.#state;
    if (fullWidth === 0 || fullHeight === 0) return null; // early return if no data

    const { rows, columns, spacer = 0, id = "" } = this.props;
    const layers = gridData.map((entry) => {
      const layerProps = {
        channelData: entry.data,
        bounds: entry.bounds,
        id: `${id}-GridLayer-${entry.row}-${entry.col}`,
        dtype: entry.dtype || "Uint16", // fallback if missing,
        pickable: false,
        extensions: [new ColorPaletteExtension()],
      };
      // @ts-expect-error - XRLayer props are not well typed
      return new XRLayer({ ...this.props, ...layerProps });
    });

    if (this.props.pickable) {
      type Data = { polygon: Polygon };
      const bottom = rows * (fullHeight + spacer);
      const right = columns * (fullWidth + spacer);
      const polygon = [
        [0, 0],
        [right, 0],
        [right, bottom],
        [0, bottom],
      ] satisfies Polygon;
      const layerProps = {
        data: [{ polygon }],
        getPolygon: (d: Data) => d.polygon,
        getFillColor: [0, 0, 0, 0], // transparent
        getLineColor: [0, 0, 0, 0],
        pickable: true, // enable picking
        id: `${id}-GridLayer-picking`,
      } satisfies SolidPolygonLayerProps<Data>;
      const layer = new SolidPolygonLayer<Data, SolidPolygonLayerProps<Data>>({ ...this.props, ...layerProps });
      layers.push(layer);
    }

    if (this.props.text) {
      type Data = { col: number; row: number; name: string };
      const layer = new TextLayer<Data, TextLayerProps<Data>>({
        id: `${id}-GridLayer-text`,
        data: gridData,
        getPosition: (d) => [d.col * (fullWidth + spacer), d.row * (fullHeight + spacer)],
        getText: (d) => d.name,
        getColor: [255, 255, 255, 255],
        getSize: 16,
        getAngle: 0,
        getTextAnchor: "start",
        getAlignmentBaseline: "top",
      });
      layers.push(layer);
    }

    return layers;
  }

  #cancelPending() {
    const state = this.#state;
    if (state.settleTimer !== null) {
      clearTimeout(state.settleTimer);
      state.settleTimer = null;
    }
    state.inFlight?.abort();
    state.inFlight = null;
    state.inFlightKey = null;
  }

  #scheduleRefresh(props: GridLayerProps) {
    const state = this.#state;
    if (state.settleTimer !== null) {
      clearTimeout(state.settleTimer);
    }
    state.settleTimer = setTimeout(() => {
      this.#state.settleTimer = null;
      const viewport = this.context.viewport;
      const context = buildGridContext(props, viewport);
      const level = this.#pickLevel(props.loaders, viewport);
      if (level !== this.#state.resolutionLevel) {
        this.setState({ resolutionLevel: level });
      }
      this.#refresh(props, level, context);
    }, VIEWPORT_SETTLE_MS);
  }

  #refresh(props: GridLayerProps, level: number, context: GridContext | null) {
    if (!context) {
      this.setState({ gridData: [] });
      return;
    }
    const state = this.#state;
    const key = requestKey(context, level, props.selections ?? []);
    // Already fetching exactly this, or already showing it: let it be. Restarting would
    // discard work that is about to produce the very same frame.
    if (key === state.inFlightKey || (state.inFlight === null && key === state.renderedKey)) {
      return;
    }

    // Supersede whatever was in flight: its result is for a viewport we have left.
    state.inFlight?.abort();
    const controller = new AbortController();
    state.inFlight = controller;
    state.inFlightKey = key;
    const requestId = state.requestId + 1;
    state.requestId = requestId;

    loadVisibleCells(context, level, props.selections ?? [], props.concurrency, controller.signal)
      .then((gridData) => {
        const current = this.#state;
        if (requestId !== current.requestId) return;
        current.inFlight = null;
        current.inFlightKey = null;
        current.renderedKey = key;
        this.setState({
          gridData,
          fullWidth: context.fullSize.width,
          fullHeight: context.fullSize.height,
        });
      })
      .catch(() => {
        // Never blank the grid on failure. An abort is the ordinary way a superseded
        // request ends, and a genuine fetch error is better answered by leaving the
        // last good frame up than by turning the plate black.
        const current = this.#state;
        if (requestId !== current.requestId) return;
        current.inFlight = null;
        current.inFlightKey = null;
      });
  }

  /** The deepest level every cell has, i.e. the coarsest resolution available to all. */
  #coarsestLevel(loaders: GridLoader[]) {
    const depths = loaders.filter((loader) => loader.sources.length > 0).map((loader) => loader.sources.length);
    return depths.length === 0 ? 0 : Math.max(0, Math.min(...depths) - 1);
  }

  #pickLevel(loaders: GridLoader[], viewport?: Viewport) {
    const coarsest = this.#coarsestLevel(loaders);
    if (coarsest <= 0) {
      return 0;
    }
    const base = loaders.find((loader) => loader.sources.length > 0);
    const screen = this.#cellScreenSize(viewport);
    if (!base || !screen) {
      return this.#state.resolutionLevel;
    }
    const levelSizes = base.sources.slice(0, coarsest + 1).map(sourceDimensions);
    return pickLevelForScreenSize(levelSizes, screen);
  }

  /** How large one cell is on screen, in pixels. */
  #cellScreenSize(viewport?: Viewport) {
    const { fullWidth, fullHeight } = this.#state;
    if (!viewport || fullWidth === 0 || fullHeight === 0) {
      return null;
    }
    const matrix = this.props.modelMatrix;
    const toWorld = (point: [number, number, number]) =>
      matrix ? (new Matrix4(matrix).transformAsPoint(point) as [number, number, number]) : point;
    const origin = viewport.project(toWorld([0, 0, 0]));
    const acrossX = viewport.project(toWorld([fullWidth, 0, 0]));
    const acrossY = viewport.project(toWorld([0, fullHeight, 0]));
    return {
      width: Math.abs(acrossX[0] - origin[0]),
      height: Math.abs(acrossY[1] - origin[1]),
    };
  }
}

export { GridLayer };
