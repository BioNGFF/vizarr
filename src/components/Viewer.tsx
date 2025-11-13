import { ScaleBarLayer } from "@hms-dbmi/viv";
import DeckGL from "deck.gl";
import { OrthographicView } from "deck.gl";
import { useAtom, useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import * as React from "react";
import { useViewState } from "../hooks";
import { layerAtoms, layerFamilyAtom, sourceInfoAtom, viewportAtom } from "../state";
import { fitImageToViewport, getLayerSize, resolveLoaderFromLayerProps } from "../utils";

import type { DeckGLRef, OrthographicViewState, PickingInfo } from "deck.gl";
import type { GrayscaleBitmapLayerPickingInfo } from "../layers/label-layer";
import type { ViewState, VizarrLayer } from "../state";

const AXIS_SCROLL_STEP_DELTA = 40;

export default function Viewer() {
  const deckRef = React.useRef<DeckGLRef>(null);
  const [viewport, setViewport] = useAtom(viewportAtom);
  const [viewState, setViewState] = useViewState();
  const layers = useAtomValue(layerAtoms);
  const firstLayer = layers[0] as VizarrLayer;
  const [axisScrollKey, setAxisScrollKey] = React.useState<"z" | "t" | null>(null);
  const axisScrollAccumulatorRef = React.useRef(0);

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

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "z" || key === "t") {
        setAxisScrollKey(key as "z" | "t");
      } // set when pressing the key
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "z" || key === "t") {
        setAxisScrollKey((prev) => (prev === key ? null : prev));
      } // reset when letting go of the key
    };

    const handleBlur = () => {
      // reset when switching windows
      setAxisScrollKey(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  React.useEffect(() => {
    // reset accumulator when axis key changes
    axisScrollAccumulatorRef.current = 0;
    void axisScrollKey;
  }, [axisScrollKey]);

  const handleWheel = useAtomCallback(
    // handle wheel events for axis scrolling
    React.useCallback(
      (get, set, event: WheelEvent) => {
        if (!axisScrollKey) {
          return; // ignore if no axis key is set, fall back to default zoom behavior
        }

        const deckInstance = viewport ?? deckRef.current?.deck ?? null;
        const canvas = (deckInstance as { canvas?: HTMLCanvasElement } | null)?.canvas;
        if (!deckInstance || !canvas) {
          return; // no deck instance or canvas
        }

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
          return; // only consider events within the canvas
        }

        const picks = (deckInstance.pickMultipleObjects({ x, y, depth: 1 }) ?? []) as PickingInfo[];
        const sources = get(sourceInfoAtom);
        if (sources.length === 0) {
          return;
        }

        const pickedLayerId = (() => {
          const pick = picks.find((info: PickingInfo) => info.layer && typeof info.layer.props?.id === "string"); // find the first layer with an id
          if (!pick || !pick.layer?.props?.id) {
            return undefined;
          }
          return String(pick.layer.props.id);
        })();

        const targetSource = pickedLayerId
          ? (sources.find(
              // find source matching picked layer id
              (item: (typeof sources)[number]) =>
                pickedLayerId === item.id ||
                pickedLayerId.startsWith(`${item.id}_`) ||
                pickedLayerId.startsWith(`${item.id}-`),
            ) ?? sources[0])
          : sources[0];

        const axisLabels = targetSource.axis_labels ?? [];
        const axisIndex = axisLabels.findIndex((axis: string) => axis.toLowerCase() === axisScrollKey); // find the index of the axis to scroll
        if (axisIndex === -1) {
          return;
        }

        // get the max index on this axis
        const baseLoader = targetSource.loader?.[0];
        const shape = baseLoader?.shape;
        if (!shape || axisIndex >= shape.length) {
          return;
        }
        const maxIndex = shape[axisIndex] - 1;
        if (maxIndex <= 0) {
          return;
        }

        const layerAtom = layerFamilyAtom(targetSource);
        const layerState = get(layerAtom);
        if (!layerState) {
          return;
        }

        const { layerProps } = layerState;
        const selections = layerProps.selections;
        if (selections.length === 0) {
          return;
        }

        // prevent the default zoom behavior
        event.preventDefault();
        event.stopPropagation();

        // calculate scroll steps
        axisScrollAccumulatorRef.current += event.deltaY;
        const steps = Math.trunc(axisScrollAccumulatorRef.current / AXIS_SCROLL_STEP_DELTA);
        if (steps === 0) {
          return;
        }

        // keep overflow for next time
        axisScrollAccumulatorRef.current -= steps * AXIS_SCROLL_STEP_DELTA;

        // keep within bounds
        const currentIndex = selections[0]?.[axisIndex] ?? 0;
        const nextIndex = Math.min(Math.max(currentIndex + steps, 0), maxIndex);
        if (nextIndex === currentIndex) {
          return;
        }

        // update the selections with the new index
        const nextSelections = selections.map((selection: number[]) => {
          const next = [...selection];
          next[axisIndex] = nextIndex;
          return next;
        });

        set(layerAtom, {
          ...layerState,
          layerProps: {
            ...layerProps,
            selections: nextSelections,
          },
        });

        const defaultSelection = nextSelections[0] ? [...nextSelections[0]] : undefined;
        if (!defaultSelection) {
          return;
        }

        set(sourceInfoAtom, (prev: typeof sources) =>
          prev.map((item: (typeof sources)[number]) => {
            if (item.id !== targetSource.id) {
              return item;
            }
            const prevSelection = item.defaults.selection;
            const isSame =
              prevSelection.length === defaultSelection.length &&
              prevSelection.every((value: number, index: number) => value === defaultSelection[index]);
            if (isSame) {
              return item;
            }
            return {
              ...item,
              defaults: {
                ...item.defaults,
                selection: defaultSelection,
              },
            };
          }),
        );
      },
      [viewport, axisScrollKey],
    ),
  );

  React.useEffect(() => {
    // attach wheel listener to deck canvas
    const deckInstance = (viewport ?? deckRef.current?.deck ?? null) as { canvas?: HTMLCanvasElement } | null;
    const element = deckInstance?.canvas;
    if (!element) {
      return;
    }

    const listener = (event: WheelEvent) => {
      void handleWheel(event);
    };

    element.addEventListener("wheel", listener, { passive: false });
    return () => {
      element.removeEventListener("wheel", listener);
    };
  }, [viewport, handleWheel]);

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
    if (!firstLayer) {
      return { near: 0.1, far: 1000 };
    }

    const zs = layers.flatMap((layer) => {
      const matrix = (layer as VizarrLayer)?.props?.modelMatrix;
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
      onDeviceInitialized={() => setViewport(deckRef.current?.deck || null)}
    />
  );
}
