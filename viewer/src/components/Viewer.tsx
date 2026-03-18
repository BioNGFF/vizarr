import { ScaleBarLayer } from "@hms-dbmi/viv";
import DeckGL from "deck.gl";
import { OrthographicView, PolygonLayer } from "deck.gl";
import { useAtom, useAtomValue } from "jotai";
import * as React from "react";
import { useViewState } from "../hooks";
import { useAxisNavigation } from "../hooks/useAxisNavigation";
import { layerAtoms, currentZInfoAtom, roiDrawStateAtom, viewportAtom } from "../state";
import { fitImageToViewport, getLayerSize, resolveLoaderFromLayerProps } from "../utils";

import type { DeckGLRef, OrthographicViewState, PickingInfo } from "deck.gl";
import { type GrayscaleBitmapLayerPickingInfo, LabelLayer } from "../layers/label-layer";
import type { ViewState, VizarrLayer } from "../state";

export default function Viewer() {
  const deckRef = React.useRef<DeckGLRef>(null);
  const [viewport, setViewport] = useAtom(viewportAtom);
  const [viewState, setViewState] = useViewState();
  const layers = useAtomValue(layerAtoms);
  const firstLayer = layers[0] as VizarrLayer;
  const axisNavigationSnackbar = useAxisNavigation(deckRef, viewport);
  // ---- ROI draw-on-image support ----
  // Read the shared draw-mode atom so we know whether to intercept clicks.
  const [roiDrawState, setRoiDrawState] = useAtom(roiDrawStateAtom);
  const isDrawing = roiDrawState !== null;

  // Current Z-axis info (may be null if there's no Z axis).
  const zInfo = useAtomValue(currentZInfoAtom);

  // Track the current mouse position in image coordinates for the preview rectangle.
  const [roiMousePos, setRoiMousePos] = React.useState<[number, number] | null>(null);

  // The first corner (if placed) — extracted for convenience.
  const roiCorner1 =
    roiDrawState && typeof roiDrawState === "object" && "corner1" in roiDrawState
      ? roiDrawState.corner1
      : null;

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
          }),
          width: deck.width,
          height: deck.height,
        });
      }
    },
    [setViewState],
  );

  React.useEffect(() => {
    if (!viewport && deckRef.current?.deck) {
      setViewport(deckRef.current.deck);
    }
    if (viewport && firstLayer) {
      if (!viewState) {
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
    const pickingInfo = info as PickingInfo & {
      gridCoord?: { row: number; column: number };
      gridLabels?: { row?: string; column?: string };
    };

    if (pickingInfo.gridCoord) {
      const { row, column } = pickingInfo.gridCoord;
      if (typeof row === "number" && typeof column === "number") {
        const rowLabel = pickingInfo.gridLabels?.row;
        const columnLabel = pickingInfo.gridLabels?.column;
        const rowText = rowLabel ? `${rowLabel}` : `${row + 1}`;
        const columnText = columnLabel ? `${columnLabel}` : `${column + 1}`;
        return { text: `${rowText}${columnText}` };
      }
    }

    const { layer, index } = pickingInfo;
    const { label, value } = info as GrayscaleBitmapLayerPickingInfo;
    if (!layer || index === null || index === undefined || !label) {
      return null;
    }
    return {
      text: value !== null && value !== undefined ? `${label}: ${value}` : `${label}`,
    };
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

  /**
   * Handle clicks on the deck.gl canvas.
   *
   * When draw mode is active (`roiDrawState !== null`), clicks are
   * intercepted to place ROI corners instead of doing the default
   * pick / tooltip behaviour.
   *
   * `info.coordinate` is the [x, y] position in **image space** (world
   * coordinates) — exactly what we need for the ROI bounding box.
   */
  const handleClick = React.useCallback(
    (info: PickingInfo) => {
      if (!isDrawing || !info.coordinate) return;

      const [x, y] = info.coordinate;

      if (roiDrawState === "waiting-first") {
        // First click → record corner 1 + current Z, wait for corner 2
        const z1 = zInfo?.zValue ?? 0;
        setRoiDrawState({ corner1: [Math.round(x), Math.round(y)], z1 });
      } else if (roiDrawState && typeof roiDrawState === "object" && "corner1" in roiDrawState) {
        // Second click → record corner 2 + current Z.
        // We use a custom event on window so RoiSelector can pick it up.
        const corner2: [number, number] = [Math.round(x), Math.round(y)];
        const z2 = zInfo?.zValue ?? 0;
        window.dispatchEvent(
          new CustomEvent("vizarr-roi-drawn", {
            detail: { corner1: roiDrawState.corner1, corner2, z1: roiDrawState.z1, z2 },
          }),
        );
        setRoiDrawState(null);
      }
    },
    [isDrawing, roiDrawState, setRoiDrawState, zInfo],
  );

  // Track mouse movement in image coordinates while waiting for the second corner.
  const handleHover = React.useCallback(
    (info: PickingInfo) => {
      if (roiCorner1 && info.coordinate) {
        setRoiMousePos([info.coordinate[0], info.coordinate[1]]);
      } else {
        setRoiMousePos(null);
      }
    },
    [roiCorner1],
  );

  // Build a preview rectangle layer when corner1 is placed and cursor is moving.
  const roiPreviewLayer = React.useMemo(() => {
    if (!roiCorner1 || !roiMousePos) return null;
    const [x1, y1] = roiCorner1;
    const [x2, y2] = roiMousePos;
    return new PolygonLayer({
      id: "roi-preview",
      data: [
        {
          polygon: [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
          ],
        },
      ],
      getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
      getFillColor: [255, 255, 255, 40],
      getLineColor: [255, 200, 0, 200],
      getLineWidth: 2,
      lineWidthUnits: "pixels",
      stroked: true,
      filled: true,
      pickable: false,
    });
  }, [roiCorner1, roiMousePos]);

  // Change the cursor to crosshair while draw mode is active
  const getCursor = React.useCallback(() => (isDrawing ? "crosshair" : "grab"), [isDrawing]);

  return (
    <>
      <DeckGL
        ref={deckRef}
        layers={[...deckLayers, ...(roiPreviewLayer ? [roiPreviewLayer] : [])]}
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
        onDeviceInitialized={() => setViewport(deckRef.current?.deck || null)}
      />
      {axisNavigationSnackbar}
    </>
  );
}
