import type { DeckGLRef, PickingInfo } from "deck.gl";
import { useAtomCallback } from "jotai/utils";
import * as React from "react";
import { layerFamilyAtom, sourceInfoAtom } from "../state";

type DeckInstance = DeckGLRef["deck"] | null;

const AXIS_SCROLL_STEP_DELTA = 40;

export function useAxisScroll(deckRef: React.RefObject<DeckGLRef>, viewport: DeckInstance) {
  const [axisScrollKey, setAxisScrollKey] = React.useState<"z" | "t" | null>(null);
  const axisScrollAccumulatorRef = React.useRef(0);

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
      [viewport, axisScrollKey, deckRef],
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
  }, [viewport, handleWheel, deckRef]);
}
