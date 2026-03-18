import { ScaleBarLayer } from "@hms-dbmi/viv";
import DeckGL from "deck.gl";
import { OrthographicView, PolygonLayer } from "deck.gl";
import { useAtom, useAtomValue } from "jotai";
import * as React from "react";
import { useViewState } from "../hooks";
import { useAxisNavigation } from "../hooks/useAxisNavigation";
import { layerAtoms, deckExtensionsAtom, viewportAtom } from "../state";
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

  const axisNavigationSnackbar = useAxisNavigation(deckRef);

  // ---- Plugin extension system ----
  const extensions = useAtomValue(deckExtensionsAtom);

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
      const d = deckRef.current.deck;
      setViewport({ width: d.width, height: d.height });
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

  // ---- Extension layers (polygon overlays from plugins) ----
  const extensionLayers = React.useMemo(() => {
    return Object.values(extensions).flatMap((ext) =>
      (ext.overlays ?? []).map(
        (overlay) =>
          new PolygonLayer({
            id: overlay.id,
            data: [{ polygon: overlay.polygon }],
            getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
            getFillColor: overlay.fillColor,
            getLineColor: overlay.lineColor,
            getLineWidth: overlay.lineWidth ?? 2,
            lineWidthUnits: "pixels" as const,
            stroked: true,
            filled: true,
            pickable: false,
          }),
      ),
    );
  }, [extensions]);

  // ---- Generic click handler (delegates to registered extensions) ----
  const handleClick = React.useCallback(
    (info: PickingInfo) => {
      if (!info.coordinate) return;
      const coord: [number, number] = [info.coordinate[0], info.coordinate[1]];
      for (const ext of Object.values(extensions)) {
        if (ext.onClick?.(coord)) return;
      }
    },
    [extensions],
  );

  // ---- Generic hover handler (delegates to registered extensions) ----
  const handleHover = React.useCallback(
    (info: PickingInfo) => {
      const coord = info.coordinate
        ? ([info.coordinate[0], info.coordinate[1]] as [number, number])
        : null;
      for (const ext of Object.values(extensions)) {
        ext.onHover?.(coord);
      }
    },
    [extensions],
  );

  // ---- Generic cursor (first extension with a cursor wins, else "grab") ----
  const getCursor = React.useCallback(() => {
    for (const ext of Object.values(extensions)) {
      if (ext.cursor) return ext.cursor;
    }
    return "grab";
  }, [extensions]);

  return (
    <>
      <DeckGL
        ref={deckRef}
        layers={[...deckLayers, ...extensionLayers]}
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
        onResize={({ width, height }: { width: number; height: number }) =>
          setViewport({ width, height })
        }
      />
      {axisNavigationSnackbar}
    </>
  );
}
