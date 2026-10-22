import { ScaleBarLayer } from "@hms-dbmi/viv";
import DeckGL, { type Layer, OrthographicView } from "deck.gl";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import * as React from "react";
import { useViewState } from "../hooks";
import { useAxisNavigation } from "../hooks/useAxisNavigation";
import { layerAtoms, navigateIntoAtom, panelInsetAtom, sourceInfoAtom, viewportAtom } from "../state";
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
export function describeHover(info: GrayscaleBitmapLayerPickingInfo | PickingInfo): string | null {
  const pickingInfo = info as PickingInfo & {
    gridCoord?: { row: number; column: number };
    gridLabels?: { row?: string; column?: string };
    gridCell?: { name: string } | null;
  };

  const coord = pickingInfo.gridCoord;
  if (coord && typeof coord.row === "number" && typeof coord.column === "number") {
    const rowLabel = pickingInfo.gridLabels?.row;
    const columnLabel = pickingInfo.gridLabels?.column;
    // A plate labels its rows and columns, so the pair names a well. A well grid does
    // not, and its cells are fields of view, which the grid already numbers on screen.
    const isWellOfPlate = Boolean(rowLabel && columnLabel);
    const name = isWellOfPlate
      ? `${rowLabel}${columnLabel}`
      : (pickingInfo.gridCell?.name ?? `${coord.row + 1}, ${coord.column + 1}`);
    const title = isWellOfPlate ? `Well ${name}` : `Field ${name}`;
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
      // A plugin that claims the click keeps it; the select tool is not a drill-down.
      if (onPluginClick?.(coord)) return;

      const picked = info as PickingInfo & {
        gridCoord?: { row: number; column: number };
        gridSourceId?: string;
      };
      if (!picked.gridCoord || !picked.gridSourceId) return;
      const source = sourceInfo.find((entry) => entry.id === picked.gridSourceId);
      const target = source?.resolveCellSource?.(picked.gridCoord);
      if (target) {
        navigateInto({ id: picked.gridSourceId, source: target });
      }
    },
    [onPluginClick, sourceInfo, navigateInto],
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

  return (
    <>
      <DeckGL
        ref={deckRef}
        layers={[...deckLayers, ...additionalLayers]}
        viewState={viewState && { ortho: viewState }}
        controller={{ keyboard: true }}
        onViewStateChange={(e: { viewState: OrthographicViewState }) =>
          // @ts-expect-error - deck doesn't know this should be ok
          setViewState(e.viewState)
        }
        views={[new OrthographicView({ id: "ortho", controller: true, near, far })]}
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
