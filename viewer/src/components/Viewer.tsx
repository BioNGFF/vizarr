import { ScaleBarLayer } from "@hms-dbmi/viv";
import DeckGL, { type Layer, OrthographicView, PolygonLayer } from "deck.gl";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import * as React from "react";
import { useViewState } from "../hooks";
import { useAxisNavigation } from "../hooks/useAxisNavigation";
import {
  OVERVIEW_DEFAULTS,
  extentCorners,
  fitExtentToBox,
  layerExtent,
  overviewBox,
  unionExtent,
  viewportCorners,
} from "../overview";
import { layerAtoms, navigateIntoAtom, overviewOnAtom, panelInsetAtom, sourceInfoAtom, viewportAtom } from "../state";
import theme, { tokens } from "../theme";
import { fitImageToViewport, getLayerSize, resolveLoaderFromLayerProps } from "../utils";

import type { DeckGLRef, OrthographicViewState, PickingInfo } from "deck.gl";
import { type GrayscaleBitmapLayerPickingInfo, LabelLayer } from "../layers/label-layer";
import type { ViewState, VizarrLayer } from "../state";

/**
 * Styling for deck.gl's tooltip, which is a plain DOM node outside the MUI tree and so
 * cannot inherit from the theme. Opaque like the menus rather than translucent like the
 * panel: it sits directly over the image and has to stay legible against any of it.
 */
const TOOLTIP_STYLE: Partial<CSSStyleDeclaration> = {
  backgroundColor: tokens.overlay.background,
  color: "#fff",
  border: `1px solid ${tokens.panel.border}`,
  borderRadius: `${tokens.panel.radius}px`,
  padding: "6px 10px",
  fontFamily: String(theme.typography.fontFamily),
  fontSize: "12px",
  lineHeight: "1.45",
  // The description is written as lines; this is what makes them render as lines.
  whiteSpace: "pre-line",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
  pointerEvents: "none",
};

/**
 * What the pointer is over, as a short block of lines, or null to show no tooltip.
 *
 * The first line names the thing; any further line adds what the name alone does not
 * say. Kept to two lines so it stays readable while the pointer is moving.
 */
/** The picking fields the grid layer adds, which deck.gl's own types do not describe. */
type GridPickingInfo = PickingInfo & {
  gridCoord?: { row: number; column: number };
  gridLabels?: { row?: string; column?: string };
  gridCell?: { name: string } | null;
  gridSourceId?: string;
};

/**
 * What to call the grid cell under the pointer, or null where the pointer is not on one.
 *
 * Shared by the tooltip and by drilling in, so that the name you are shown before the
 * click is the name the image carries afterwards.
 */
export function gridCellName(info: PickingInfo): string | null {
  const picked = info as GridPickingInfo;
  const coord = picked.gridCoord;
  if (!coord || typeof coord.row !== "number" || typeof coord.column !== "number") {
    return null;
  }
  const rowLabel = picked.gridLabels?.row;
  const columnLabel = picked.gridLabels?.column;
  // A plate labels its rows and columns, so the pair names a well. A well grid does
  // not, and its cells are fields of view, which the grid already numbers on screen.
  if (rowLabel && columnLabel) {
    return `Well ${rowLabel}${columnLabel}`;
  }
  return `Field ${picked.gridCell?.name ?? `${coord.row + 1}, ${coord.column + 1}`}`;
}

export function describeHover(info: GrayscaleBitmapLayerPickingInfo | PickingInfo): string | null {
  const pickingInfo = info as GridPickingInfo;

  const title = gridCellName(pickingInfo);
  if (title !== null) {
    // Distinguishing an empty position from one that is merely still loading would
    // need the layer to track both; an absent image is the common case and the one a
    // user can act on.
    return pickingInfo.gridCell === null ? `${title}\nNo image` : title;
  }

  const { layer, index } = pickingInfo;
  const { label, value } = info as GrayscaleBitmapLayerPickingInfo;
  if (!layer || index === null || index === undefined || !label) {
    return null;
  }
  // `label` is the segmentation id under the pointer; `value` is whatever a host has
  // mapped onto it. Naming both beats the bare "42: 0.9" this used to show.
  return value === null || value === undefined ? `Label ${label}` : `Label ${label}\nValue ${value}`;
}

/** The id deck knows the overview viewport by, used to route layers and clicks. */
const OVERVIEW_VIEW_ID = "overview";

/** Marks the copy of a layer that belongs to the overview. */
const OVERVIEW_SUFFIX = "-overview";

/** The outlines layer, which exists only inside the overview. */
const OVERVIEW_OUTLINES_ID = "overview-outlines";

/** Viv's colours for the two outlines, so an overview here looks like one elsewhere. */
const IMAGE_OUTLINE: [number, number, number] = [255, 0, 0];
const VIEWPORT_OUTLINE: [number, number, number] = [255, 190, 0];

interface ViewerProps {
  additionalLayers?: Layer[];
  pluginCursor?: string;
  onPluginClick?: (coordinate: [number, number]) => boolean;
  onPluginHover?: (coordinate: [number, number] | null) => void;
}

export default function Viewer({ additionalLayers = [], pluginCursor, onPluginClick, onPluginHover }: ViewerProps) {
  const deckRef = React.useRef<DeckGLRef>(null);
  const [viewport, setViewport] = useAtom(viewportAtom);
  const [viewState, setViewState] = useViewState();
  const layers = useAtomValue(layerAtoms);
  const sourceInfo = useAtomValue(sourceInfoAtom);
  const navigateInto = useSetAtom(navigateIntoAtom);
  const firstLayer = layers[0] as VizarrLayer;
  const axisNavigationSnackbar = useAxisNavigation(deckRef);
  /** The image extent the current view state was fitted to. */
  const fittedExtentRef = React.useRef<string | null>(null);

  const panelInset = useAtomValue(panelInsetAtom);
  const overviewOn = useAtomValue(overviewOnAtom);

  /**
   * The overview, or null where there is nothing to overview.
   *
   * Not drawn for a plate or a well. A grid is already an overview: it shows every
   * position at once and is navigated by clicking into one, so a smaller copy of the same
   * arrangement in the corner offers a way to get lost rather than a way to orient.
   */
  const overview = React.useMemo(() => {
    const isGrid = sourceInfo.some((source) => source.loaders);
    if (!overviewOn || isGrid || !viewport || !viewState) {
      return null;
    }
    // The union of every source, not the first. The scale bar and the compass read the
    // first because they describe a frame of reference and several images can disagree
    // about one; this describes where you are looking, and elements registered against
    // each other would be cut off by framing only one of them.
    const extent = unionExtent(
      layers
        .filter((layer): layer is VizarrLayer => Boolean(layer) && !(layer instanceof LabelLayer))
        .map((layer) => layerExtent(getLayerSize(layer), layer.props.modelMatrix)),
    );
    if (!extent) {
      return null;
    }
    const box = overviewBox(viewport, extent);
    return { extent, box, viewState: fitExtentToBox(extent, box, OVERVIEW_DEFAULTS.padding) };
  }, [overviewOn, sourceInfo, viewport, viewState, layers]);
  const resetViewState = React.useCallback(
    (layer: VizarrLayer) => {
      const { deck } = deckRef.current || {};
      if (deck) {
        setViewState({
          ...fitImageToViewport({
            image: getLayerSize(layer),
            viewport: deck,
            padding: deck.width < 400 ? 10 : deck.width < 600 ? 30 : 50,
            matrix: layer?.props.modelMatrix,
            insetLeft: panelInset,
          }),
          width: deck.width,
          height: deck.height,
        });
      }
    },
    [setViewState, panelInset],
  );

  React.useEffect(() => {
    if (!viewport && deckRef.current?.deck) {
      const d = deckRef.current.deck;
      setViewport({ width: d.width, height: d.height });
    }
    if (viewport && firstLayer) {
      // Refit whenever the image being shown changes extent, which is what navigating
      // into a well does: it would otherwise keep the plate's zoom and draw the well a
      // fraction of its size. Keyed on extent rather than on the layer changing at all,
      // so switching acquisition -- same geometry, different timepoint -- does not yank
      // the view away from wherever it was.
      const { width, height } = getLayerSize(firstLayer);
      const extent = `${width}x${height}`;
      if (!viewState || fittedExtentRef.current !== extent) {
        fittedExtentRef.current = extent;
        resetViewState(firstLayer);
      } else if (!(viewState?.width || viewState?.height)) {
        setViewState((vs) => ({
          ...(vs as ViewState),
          width: viewport.width,
          height: viewport.height,
        }));
      }
    }
  }, [viewport, setViewport, firstLayer, resetViewState, viewState, setViewState]);

  const deckLayers = React.useMemo(() => {
    if (!firstLayer || !(viewState?.width && viewState?.height)) {
      return layers;
    }
    const loader = resolveLoaderFromLayerProps(firstLayer.props);
    if (Array.isArray(loader) && loader?.[0]?.meta?.physicalSizes?.x) {
      const { size, unit } = loader[0].meta.physicalSizes.x;
      const scalebar = new ScaleBarLayer({
        id: "scalebar",
        size: size / firstLayer.props.modelMatrix[0],
        unit: unit,
        viewState: viewState,
        snap: false,
      });
      return [...layers, scalebar];
    }
    return layers;
  }, [layers, firstLayer, viewState]);

  // Enables screenshots of the canvas: https://github.com/visgl/deck.gl/issues/2200
  const glOptions: WebGLContextAttributes = {
    preserveDrawingBuffer: true,
  };

  const getTooltip = (info: GrayscaleBitmapLayerPickingInfo | PickingInfo) => {
    const text = describeHover(info);
    return text === null ? null : { text, style: TOOLTIP_STYLE };
  };

  const { near, far } = React.useMemo(() => {
    if (!layers.length) {
      return { near: 0.1, far: 1000 };
    }

    const zs = layers.flatMap((layer: VizarrLayer | null) => {
      if (!layer || layer instanceof LabelLayer) return [];
      const { modelMatrix: matrix } = layer?.props || {};
      if (!matrix) return [];
      const { width, height } = getLayerSize(layer);
      const corners = [
        [0, 0, 0],
        [width, 0, 0],
        [width, height, 0],
        [0, height, 0],
      ].map((corner) => matrix.transformAsPoint(corner)[2]);
      return corners;
    });

    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    return {
      near: maxZ ? -10000 * Math.abs(maxZ) : 0.1,
      far: minZ ? 10000 * Math.abs(minZ) : 1000,
    };
  }, [layers]);

  // ---- Click handler (delegates to plugins, then drills into a grid cell) ----
  const handleClick = React.useCallback(
    (info: PickingInfo) => {
      if (!info.coordinate) return;
      const coord: [number, number] = [info.coordinate[0], info.coordinate[1]];

      // A click in the overview means "look here", and nothing else. Without this it
      // would go on to be offered to the plugins and then to the grid, so clicking the
      // overview of a plate would navigate into whichever well was under the pointer.
      if (info.viewport?.id === OVERVIEW_VIEW_ID) {
        setViewState((previous) => (previous ? { ...previous, target: coord } : previous));
        return;
      }

      // A plugin that claims the click keeps it; the select tool is not a drill-down.
      if (onPluginClick?.(coord)) return;

      const picked = info as GridPickingInfo;
      if (!picked.gridCoord || !picked.gridSourceId) return;
      const source = sourceInfo.find((entry) => entry.id === picked.gridSourceId);
      const target = source?.resolveCellSource?.(picked.gridCoord);
      if (target) {
        // A field of a well rarely names itself, so the grid's own name for the cell
        // stands in; without it the panel header would be blank.
        navigateInto({ id: picked.gridSourceId, source: target, name: gridCellName(picked) ?? undefined });
      }
    },
    [onPluginClick, sourceInfo, navigateInto, setViewState],
  );

  // ---- Hover handler (delegates to plugins) ----
  const handleHover = React.useCallback(
    (info: PickingInfo) => {
      const coord = info.coordinate ? ([info.coordinate[0], info.coordinate[1]] as [number, number]) : null;
      onPluginHover?.(coord);
    },
    [onPluginHover],
  );

  // ---- Cursor ----
  const getCursor = React.useCallback(() => {
    return pluginCursor ?? "grab";
  }, [pluginCursor]);

  /**
   * The two outlines drawn in the overview: everything there is, and the part on screen.
   *
   * A polygon rather than a positioned `div`. The rectangle is the inverse of fitting the
   * image to the viewport, and reconciling screen pixels with image coordinates by hand
   * is what makes that arithmetic fiddly; inside a viewport, deck does the reconciling.
   */
  const overviewOutlines = React.useMemo(() => {
    if (!overview || !viewState) {
      return [];
    }
    return [
      new PolygonLayer({
        id: OVERVIEW_OUTLINES_ID,
        data: [
          { polygon: extentCorners(overview.extent), color: IMAGE_OUTLINE, width: 1 },
          { polygon: viewportCorners(viewState), color: VIEWPORT_OUTLINE, width: 2 },
        ],
        filled: false,
        stroked: true,
        getPolygon: (d: { polygon: Array<[number, number]> }) => d.polygon,
        getLineColor: (d: { color: [number, number, number] }) => d.color,
        getLineWidth: (d: { width: number }) => d.width,
        lineWidthUnits: "pixels",
        pickable: false,
      }),
    ];
  }, [overview, viewState]);

  /**
   * The overview's own copies of the layers.
   *
   * Deck will draw one layer instance into several views, and for most layers that is
   * what you want. A tiled layer is the exception: it resolves which resolution to fetch
   * from the viewport it is updated against, and keeps one tileset. Shared between a
   * detail view and an overview, the overview's zoom wins and the detail view is left
   * drawing the lowest level of the pyramid -- an 8-level Xenium slide goes visibly soft
   * the moment the overview is opened, while a single-tile image shows nothing wrong
   * because it has nothing to drop to.
   *
   * So the overview gets its own instances. They are cheap: the tiles they ask for are
   * the small ones.
   */
  const overviewLayers = React.useMemo(() => {
    if (!overview) {
      return [];
    }
    return layers
      .filter((layer): layer is VizarrLayer => Boolean(layer))
      .map((layer) =>
        // `clone` is deck's own, and handles the async props a layer may be holding. It
        // is missing from the published types rather than from the class.
        (layer as unknown as { clone(props: object): Layer }).clone({
          id: `${layer.id}${OVERVIEW_SUFFIX}`,
          pickable: false,
        }),
      );
  }, [overview, layers]);

  const views = React.useMemo(() => {
    const ortho = new OrthographicView({ id: "ortho", controller: true, near, far });
    if (!overview) {
      return [ortho];
    }
    return [ortho, new OrthographicView({ id: OVERVIEW_VIEW_ID, controller: false, clear: true, ...overview.box })];
  }, [near, far, overview]);

  /**
   * Which layers belong in which viewport.
   *
   * Everything carrying the overview's suffix goes to the overview and nothing else does,
   * which keeps the scale bar and any plugin's layers -- measurements and annotations,
   * both of which belong to the view they were made in -- out of the corner by default.
   */
  const layerFilter = React.useCallback(({ layer, viewport: vp }: { layer: Layer; viewport: { id: string } }) => {
    const forOverview = layer.id.endsWith(OVERVIEW_SUFFIX) || layer.id === OVERVIEW_OUTLINES_ID;
    return (vp.id === OVERVIEW_VIEW_ID) === forOverview;
  }, []);

  return (
    <>
      <DeckGL
        ref={deckRef}
        layers={[...deckLayers, ...additionalLayers, ...overviewLayers, ...overviewOutlines]}
        viewState={viewState && { ortho: viewState, ...(overview ? { [OVERVIEW_VIEW_ID]: overview.viewState } : {}) }}
        controller={{ keyboard: true }}
        onViewStateChange={(e: { viewState: OrthographicViewState }) =>
          // @ts-expect-error - deck doesn't know this should be ok
          setViewState(e.viewState)
        }
        views={views}
        layerFilter={layerFilter}
        glOptions={glOptions}
        getTooltip={getTooltip}
        onClick={handleClick}
        onHover={handleHover}
        getCursor={getCursor}
        onDeviceInitialized={() => {
          const d = deckRef.current?.deck;
          setViewport(d ? { width: d.width, height: d.height } : null);
        }}
        onResize={({ width, height }: { width: number; height: number }) => setViewport({ width, height })}
      />
      {axisNavigationSnackbar}
    </>
  );
}
