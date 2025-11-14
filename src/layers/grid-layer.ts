import { CompositeLayer, SolidPolygonLayer, TextLayer } from "deck.gl";
import type { Viewport } from "deck.gl";
import { Matrix4 } from "math.gl";
import pMap from "p-map";

import { ColorPaletteExtension, XRLayer } from "@hms-dbmi/viv";
import type { SupportedTypedArray } from "@vivjs/types";
import type { CompositeLayerProps, PickingInfo, SolidPolygonLayerProps, TextLayerProps } from "deck.gl";
import type { ZarrPixelSource } from "../ZarrPixelSource";
import { assert } from "../utils";
import type { BaseLayerProps } from "./viv-layers";

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

const MIN_PIXELS_PER_DATA_PIXEL = 0.5;

type DeckBounds = [left: number, bottom: number, right: number, top: number];

type CellBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type Dimensions = {
  width: number;
  height: number;
};

type VisibleGridCell = {
  loader: GridLoader;
  cellBounds: CellBounds;
  viewportBounds: CellBounds;
};

type GridContext = {
  fullSize: Dimensions;
  spacer: number;
  visibleCells: VisibleGridCell[];
};

type GridDataEntry = GridLoader & {
  bounds: DeckBounds;
  coversWholeCell: boolean;
  source: ZarrPixelSource;
  sourceIndex: number;
  data: {
    data: SupportedTypedArray[];
    width: number;
    height: number;
  };
};

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function getCellBounds(loader: GridLoader, width: number, height: number, spacer: number): CellBounds {
  const left = loader.col * (width + spacer);
  const top = loader.row * (height + spacer);
  const right = left + width;
  const bottom = top + height;
  return { left, top, right, bottom };
}

function toDeckBounds(bounds: CellBounds): DeckBounds {
  return [bounds.left, bounds.bottom, bounds.right, bounds.top];
}

function intersectBounds(a: CellBounds, b: CellBounds): CellBounds | null {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) {
    return null;
  }
  return { left, right, top, bottom };
}

function getViewportBounds(viewport: Viewport, modelMatrix?: Matrix4): CellBounds {
  let inverse: Matrix4 | null = null;
  if (modelMatrix) {
    try {
      inverse = new Matrix4(modelMatrix).invert();
    } catch {
      inverse = null;
    }
  }
  const corners = [
    viewport.unproject([0, 0, 0]),
    viewport.unproject([viewport.width, 0, 0]),
    viewport.unproject([viewport.width, viewport.height, 0]),
    viewport.unproject([0, viewport.height, 0]),
  ];
  const transformed = inverse ? corners.map((corner) => inverse.transformAsPoint(corner)) : corners;
  const xs = transformed.map((p) => p[0]);
  const ys = transformed.map((p) => p[1]);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

function getAllGridCells(loaders: GridLoader[], cellSize: Dimensions, spacer: number): VisibleGridCell[] {
  const { width, height } = cellSize;
  if (width === 0 || height === 0) {
    return [];
  }
  return loaders
    .filter((loader) => loader.sources.length > 0)
    .map((loader) => {
      const cellBounds = getCellBounds(loader, width, height, spacer);
      return {
        loader,
        cellBounds,
        viewportBounds: cellBounds,
      };
    });
}

function getVisibleGridCells(
  loaders: GridLoader[],
  viewport: Viewport,
  cellSize: Dimensions,
  spacer: number,
  modelMatrix?: Matrix4,
): VisibleGridCell[] {
  const { width, height } = cellSize;
  if (width === 0 || height === 0) {
    return [];
  }
  const viewportBounds = getViewportBounds(viewport, modelMatrix);
  const visible: VisibleGridCell[] = [];
  for (const loader of loaders) {
    if (loader.sources.length === 0) {
      continue;
    }
    const cellBounds = getCellBounds(loader, width, height, spacer);
    const intersection = intersectBounds(cellBounds, viewportBounds);
    if (intersection) {
      visible.push({ loader, cellBounds, viewportBounds: intersection });
    }
  }
  return visible;
}

function computeWindowForSource(options: {
  viewportBounds: CellBounds;
  cellBounds: CellBounds;
  fullSize: Dimensions;
  levelSize: Dimensions;
}): {
  window?: { x: [number, number]; y: [number, number] };
  renderBounds: CellBounds;
  coversWholeCell: boolean;
} {
  const { viewportBounds, cellBounds, fullSize, levelSize } = options;
  const { width: levelWidth, height: levelHeight } = levelSize;
  if (levelWidth === 0 || levelHeight === 0) {
    return { window: undefined, renderBounds: cellBounds, coversWholeCell: true };
  }

  const pixelSizeX = fullSize.width / levelWidth;
  const pixelSizeY = fullSize.height / levelHeight;

  const localLeft = clamp(viewportBounds.left - cellBounds.left, 0, fullSize.width);
  const localRight = clamp(viewportBounds.right - cellBounds.left, 0, fullSize.width);
  const localTop = clamp(viewportBounds.top - cellBounds.top, 0, fullSize.height);
  const localBottom = clamp(viewportBounds.bottom - cellBounds.top, 0, fullSize.height);

  const xStart = Math.max(0, Math.floor(localLeft / pixelSizeX));
  const xEnd = Math.min(levelWidth, Math.max(xStart + 1, Math.ceil(localRight / pixelSizeX)));
  const yStart = Math.max(0, Math.floor(localTop / pixelSizeY));
  const yEnd = Math.min(levelHeight, Math.max(yStart + 1, Math.ceil(localBottom / pixelSizeY)));

  const coversWholeCell = xStart === 0 && xEnd === levelWidth && yStart === 0 && yEnd === levelHeight;

  const renderBounds: CellBounds = coversWholeCell
    ? cellBounds
    : {
        left: cellBounds.left + xStart * pixelSizeX,
        right: cellBounds.left + xEnd * pixelSizeX,
        top: cellBounds.top + yStart * pixelSizeY,
        bottom: cellBounds.top + yEnd * pixelSizeY,
      };

  const window = coversWholeCell
    ? undefined
    : {
        x: [xStart, xEnd] as [number, number],
        y: [yStart, yEnd] as [number, number],
      };

  return { window, renderBounds, coversWholeCell };
}

function buildGridContext(props: GridLayerProps, viewport?: Viewport): GridContext | null {
  const { loaders, spacer = 0 } = props;
  if (loaders.length === 0) {
    return null;
  }
  const baseLoader = loaders.find((loader) => loader.sources.length > 0);
  if (!baseLoader) {
    return null;
  }
  const fullSize = getSourceDimensions(baseLoader.sources[0]);
  if (fullSize.width === 0 || fullSize.height === 0) {
    return null;
  }
  const visibleCells = viewport
    ? getVisibleGridCells(loaders, viewport, fullSize, spacer, props.modelMatrix as Matrix4 | undefined)
    : getAllGridCells(loaders, fullSize, spacer);
  return { fullSize, spacer, visibleCells };
}

function getEffectiveConcurrency(concurrency: number | undefined, selectionCount: number) {
  if (!concurrency) {
    return undefined;
  }
  if (selectionCount <= 0) {
    return concurrency;
  }
  return Math.max(1, Math.ceil(concurrency / selectionCount));
}

async function loadVisibleCell(
  cell: VisibleGridCell,
  level: number,
  selections: number[][],
  context: GridContext,
): Promise<GridDataEntry> {
  const { loader } = cell;
  assert(loader.sources.length > 0, "Grid loader is missing pixel sources");
  const sourceIndex = Math.min(level, loader.sources.length - 1);
  const source = loader.sources[sourceIndex];
  const levelSize = getSourceDimensions(source);
  const { window, renderBounds, coversWholeCell } = computeWindowForSource({
    viewportBounds: cell.viewportBounds,
    cellBounds: cell.cellBounds,
    fullSize: context.fullSize,
    levelSize,
  });
  const tiles = await Promise.all(selections.map((selection) => source.getRaster({ selection, window })));
  const firstTile = tiles[0];
  const width = firstTile?.width ?? 0;
  const height = firstTile?.height ?? 0;
  return {
    ...loader,
    bounds: toDeckBounds(renderBounds),
    coversWholeCell,
    source,
    sourceIndex,
    data: {
      data: tiles.map((tile) => tile.data) as SupportedTypedArray[],
      width,
      height,
    },
  };
}

function refreshGridData(
  context: GridContext,
  level: number,
  selections: number[][],
  concurrency?: number,
): Promise<GridDataEntry[]> {
  if (context.visibleCells.length === 0) {
    return Promise.resolve([]);
  }
  const effectiveConcurrency = getEffectiveConcurrency(concurrency, selections.length);
  return pMap(context.visibleCells, (cell) => loadVisibleCell(cell, level, selections, context), {
    concurrency: effectiveConcurrency,
  });
}

function validateWidthHeight(data: GridDataEntry[]) {
  const [first] = data;
  const { width, height } = first.data;
  for (const entry of data) {
    const current = entry.data;
    if (!current) {
      continue;
    }
    assert(current.width === width && current.height === height, "Grid data is not same shape.");
  }
  return { width, height };
}

function getSourceDimensions(source: ZarrPixelSource) {
  const labels = source.labels as unknown as string[];
  const xIndex = labels.indexOf("x");
  const yIndex = labels.indexOf("y");
  assert(xIndex !== -1 && yIndex !== -1, "Expected pixel source with x/y axes");
  return {
    width: source.shape[xIndex],
    height: source.shape[yIndex],
  };
}

type SharedLayerState = {
  gridData: GridDataEntry[];
  fullWidth: number;
  fullHeight: number;
  resolutionLevel: number;
};

class GridLayer extends CompositeLayer<CompositeLayerProps & GridLayerProps> {
  static layerName = "VizarrGridLayer";
  static defaultProps = {
    // @ts-expect-error - XRLayer props are not typed
    ...XRLayer.defaultProps,
    loaders: { type: "array", value: [], compare: true },
    spacer: { type: "number", value: 5, compare: true },
    rows: { type: "number", value: 0, compare: true },
    columns: { type: "number", value: 0, compare: true },
    concurrency: { type: "number", value: 10, compare: false },
    text: { type: "boolean", value: false, compare: true },
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
    const initialLevel = this.#getInitialResolutionLevel(this.props.loaders);
    const context = buildGridContext(this.props, this.context.viewport);
    this.#state = {
      gridData: [],
      fullWidth: context?.fullSize.width ?? 0,
      fullHeight: context?.fullSize.height ?? 0,
      resolutionLevel: initialLevel,
    };
    if (context) {
      this.#refreshAndSetState(this.props, initialLevel, this.context.viewport, context);
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: deck.gl typing does not expose narrowed props
  shouldUpdateState({ changeFlags, props, oldProps }: any) {
    if (changeFlags.viewportChanged) {
      return true;
    }
    const nextProps = props as GridLayerProps;
    const prevProps = oldProps as GridLayerProps;
    if (nextProps.selections !== prevProps.selections) {
      return true;
    }
    return Boolean(changeFlags.propsChanged || changeFlags.dataChanged);
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
    const selectionChanged = props.selections !== oldProps.selections;
    const context = buildGridContext(props, this.context.viewport);

    if (loaderChanged) {
      this.setState({
        fullWidth: context?.fullSize.width ?? 0,
        fullHeight: context?.fullSize.height ?? 0,
      });
    }

    if (loaderChanged || selectionChanged) {
      this.#refreshAndSetState(props, this.#state.resolutionLevel, this.context.viewport, context ?? undefined);
      return;
    }

    if (changeFlags.viewportChanged) {
      const level = this.#pickResolutionLevel(props.loaders, this.context.viewport);
      if (level !== this.#state.resolutionLevel) {
        this.setState({ resolutionLevel: level });
      }
      this.#refreshAndSetState(props, level, this.context.viewport, context ?? undefined);
    }
  }

  getPickingInfo({ info }: { info: PickingInfo }) {
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
    return {
      ...info,
      gridCoord: { row, column },
      gridLabels: {
        row: rowLabels?.[row],
        column: columnLabels?.[column],
      },
    };
  }

  renderLayers() {
    const { gridData, fullWidth, fullHeight } = this.#state;
    if (fullWidth === 0 || fullHeight === 0) {
      return null;
    }

    const { rows, columns, spacer = 0, id = "" } = this.props;
    const layers = gridData.map((entry) => {
      const layerProps = {
        channelData: entry.data,
        bounds: entry.bounds,
        id: `${id}-GridLayer-${entry.row}-${entry.col}`,
        dtype: entry.source?.dtype || entry.sources[0]?.dtype || "Uint16",
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
        getFillColor: [0, 0, 0, 0],
        getLineColor: [0, 0, 0, 0],
        pickable: true,
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

  #refreshAndSetState(
    props: GridLayerProps,
    level: number,
    viewport?: Viewport,
    context?: GridContext | null,
  ) {
    const resolvedContext = context ?? buildGridContext(props, viewport);
    if (!resolvedContext) {
      this.setState({ gridData: [] });
      return;
    }
    const selections = props.selections ?? [];
    refreshGridData(resolvedContext, level, selections, props.concurrency)
      .then((gridData) => {
        if (this.#state.resolutionLevel !== level) {
          return;
        }
        if (gridData.length > 0) {
          const shouldValidate = gridData.every((entry) => entry.coversWholeCell);
          if (shouldValidate) {
            validateWidthHeight(gridData);
          }
        }
        this.setState({
          gridData,
          fullWidth: resolvedContext.fullSize.width,
          fullHeight: resolvedContext.fullSize.height,
        });
      })
      .catch(() => {
        if (this.#state.resolutionLevel !== level) {
          return;
        }
        this.setState({ gridData: [] });
      });
  }

  #getFullResolutionSize(loaders: GridLoader[]) {
    const first = loaders.find((loader) => loader.sources.length > 0);
    if (!first) {
      return { width: 0, height: 0 };
    }
    return getSourceDimensions(first.sources[0]);
  }

  #getMaxValidLevel(loaders: GridLoader[]) {
    if (loaders.length === 0) {
      return 0;
    }
    const minSources = loaders.reduce((min, loader) => Math.min(min, loader.sources.length), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(minSources)) {
      return 0;
    }
    return Math.max(0, minSources - 1);
  }

  #getInitialResolutionLevel(loaders: GridLoader[]) {
    return this.#getMaxValidLevel(loaders);
  }

  #getLevelDimensions(loaders: GridLoader[]) {
    const first = loaders.find((loader) => loader.sources.length > 0);
    if (!first) {
      return [] as Array<{ width: number; height: number }>;
    }
    return first.sources.map((source) => getSourceDimensions(source));
  }

  #pickResolutionLevel(loaders: GridLoader[], viewport?: Viewport) {
    const maxLevel = this.#getMaxValidLevel(loaders);
    if (maxLevel <= 0) {
      return 0;
    }
    const dimensions = this.#getLevelDimensions(loaders).slice(0, maxLevel + 1);
    if (dimensions.length <= 1) {
      return 0;
    }
    const screenSize = this.#getCellScreenSize(viewport);
    if (!screenSize) {
      return this.#state.resolutionLevel;
    }

    for (let level = 0; level < dimensions.length; level += 1) {
      const { width, height } = dimensions[level];
      if (width === 0 || height === 0) {
        continue;
      }
      const ratio = Math.min(screenSize.width / width, screenSize.height / height);
      if (ratio >= MIN_PIXELS_PER_DATA_PIXEL) {
        return level;
      }
    }
    return dimensions.length - 1;
  }

  #getCellScreenSize(viewport?: Viewport) {
    if (!viewport) {
      return null;
    }
    const { fullWidth, fullHeight } = this.#state;
    if (fullWidth === 0 || fullHeight === 0) {
      return null;
    }
    const topLeft = this.#applyModelMatrix([0, 0, 0]);
    const topRight = this.#applyModelMatrix([fullWidth, 0, 0]);
    const bottomLeft = this.#applyModelMatrix([0, fullHeight, 0]);
    const projectedTopLeft = viewport.project(topLeft);
    const projectedTopRight = viewport.project(topRight);
    const projectedBottomLeft = viewport.project(bottomLeft);
    const width = Math.abs(projectedTopRight[0] - projectedTopLeft[0]);
    const height = Math.abs(projectedBottomLeft[1] - projectedTopLeft[1]);
    return { width, height };
  }

  #applyModelMatrix(point: [number, number, number]) {
    const matrix = this.props.modelMatrix as Matrix4 | undefined;
    if (!matrix) {
      return point;
    }
    const transformed = matrix.transformAsPoint(point);
    return [transformed[0], transformed[1], transformed[2] ?? 0];
  }
}

export { GridLayer };
