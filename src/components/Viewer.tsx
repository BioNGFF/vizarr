import DeckGL from "deck.gl";
import { OrthographicView } from "deck.gl";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useViewState } from "../hooks";
import { layerAtoms } from "../state";
import { fitImageToViewport, isGridLayerProps, isInterleaved, resolveLoaderFromLayerProps } from "../utils";
import { ScaleBarLayer } from "@hms-dbmi/viv";

import type { DeckGLRef, OrthographicViewState, PickingInfo } from "deck.gl";
import type { VizarrLayer } from "../state";
import type { GrayscaleBitmapLayerPickingInfo } from "../layers/label-layer";

export default function Viewer() {
  const deckRef = React.useRef<DeckGLRef>(null);
  const [viewState, setViewState] = useViewState();
  const layers = useAtomValue(layerAtoms);
  const firstLayer = layers[0];

  // If viewState hasn't been updated, use the first loader to guess viewState
  // TODO: There is probably a better place / way to set the intital view and this is a hack.
  if (deckRef.current?.deck && !viewState && firstLayer) {
    const { deck } = deckRef.current;
    setViewState(
      fitImageToViewport({
        image: getLayerSize(firstLayer),
        viewport: deck,
        padding: deck.width < 400 ? 10 : deck.width < 600 ? 30 : 50, // Adjust depending on viewport width.
        matrix: firstLayer.props.modelMatrix,
      }),
    );
  }

  const deckLayers = React.useMemo(() => {
    if (!firstLayer || !viewState) {
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

  const getTooltip = ({ layer, index, ...props }: GrayscaleBitmapLayerPickingInfo | PickingInfo) => {
    const { label, value } = props as GrayscaleBitmapLayerPickingInfo;
    if (!layer || index === null || index === undefined) {
      return null;
    }
    return {
      text:
        value !== null && value !== undefined
          ? `${label}: ${value}`
          : `${label}`,
    };
  };

  const { near, far } = React.useMemo(() => {
    if (!firstLayer) {
      return { near: 0.1, far: 1000 };
    }

    const zs = layers.flatMap((layer) => {
      const { modelMatrix: matrix } = layer?.props || {};
      if (!matrix) {
        return [];
      }
      const { width, height } = getLayerSize(firstLayer);
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
  }, [layers, firstLayer]);

  return (
    <DeckGL
      ref={deckRef}
      layers={deckLayers}
      viewState={viewState && { ortho: viewState }}
      onViewStateChange={(e: { viewState: OrthographicViewState }) =>
        // @ts-expect-error - deck doesn't know this should be ok
        setViewState(e.viewState)
      }
      views={[new OrthographicView({ id: "ortho", controller: true, near, far })]}
      glOptions={glOptions}
      getTooltip={getTooltip}
    />
  );
}

function getLayerSize({ props }: VizarrLayer) {
  const loader = resolveLoaderFromLayerProps(props);
  const [baseResolution, maxZoom] = Array.isArray(loader) ? [loader[0], loader.length] : [loader, 0];
  const interleaved = isInterleaved(baseResolution.shape);
  let [height, width] = baseResolution.shape.slice(interleaved ? -3 : -2);
  if (isGridLayerProps(props)) {
    // TODO: Don't hardcode spacer size. Probably best to inspect the deck.gl Layers rather than
    // the Layer Props.
    const spacer = 5;
    height = (height + spacer) * props.rows;
    width = (width + spacer) * props.columns;
  }
  return { height, width, maxZoom };
}
