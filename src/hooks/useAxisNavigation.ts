import type { DeckGLRef, PickingInfo } from "deck.gl";
import { useAtomCallback } from "jotai/utils";
import * as React from "react";
import { layerFamilyAtom, sourceInfoAtom } from "../state";

type DeckInstance = DeckGLRef["deck"] | null;

type Axis = "z" | "t";
type AdjustArgs = {
  axis: Axis;
  delta: number;
  pointer?: { x: number; y: number };
};

const AXIS_SCROLL_STEP_DELTA = 40;

export function useAxisNavigation(deckRef: React.RefObject<DeckGLRef>, viewport: DeckInstance) {
  const [axisScrollKey, setAxisScrollKey] = React.useState<Axis | null>(null);
  const axisScrollKeyRef = React.useRef<Axis | null>(null);
  const axisScrollAccumulatorRef = React.useRef(0);
  const lastPointerRef = React.useRef<{ x: number; y: number } | undefined>(undefined);
  const lastTargetSourceIdRef = React.useRef<string | undefined>(undefined);

  const updateAxisScrollKey = React.useCallback((nextKey: Axis | null) => {
    axisScrollKeyRef.current = nextKey;
    setAxisScrollKey(nextKey);
  }, []);

  const adjustAxis = useAtomCallback(
    React.useCallback(
      (get, set, { axis, delta, pointer }: AdjustArgs) => {
        if (delta === 0) {
          return;
        }

        const deckInstance = viewport ?? deckRef.current?.deck ?? null;
        const canvas = (deckInstance as { canvas?: HTMLCanvasElement } | null)?.canvas;
        if (!deckInstance || !canvas) {
          return; // no deck instance or canvas
        }

        const rect = canvas.getBoundingClientRect();
        if (pointer) {
          lastPointerRef.current = pointer;
        }

        const sources = get(sourceInfoAtom);
        if (sources.length === 0) {
          return;
        }

        const getAxisIndex = (source: (typeof sources)[number]) =>
          (source.axis_labels ?? []).findIndex((label) => label.toLowerCase() === axis);

        const pointerToUse = pointer ?? lastPointerRef.current;

        let targetSource: (typeof sources)[number] | undefined;
        let axisIndex = -1;

        if (pointerToUse) {
          const { x, y } = pointerToUse;
          if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
            const picks = (deckInstance.pickMultipleObjects({ x, y, depth: 1 }) ?? []) as PickingInfo[];
            const pickedLayerId = (() => {
              const pick = picks.find((info: PickingInfo) => info.layer && typeof info.layer.props?.id === "string");
              if (!pick || !pick.layer?.props?.id) {
                return undefined;
              }
              return String(pick.layer.props.id);
            })();

            if (pickedLayerId) {
              targetSource = sources.find(
                (item) =>
                  pickedLayerId === item.id ||
                  pickedLayerId.startsWith(`${item.id}_`) ||
                  pickedLayerId.startsWith(`${item.id}-`),
              );
              if (targetSource) {
                axisIndex = getAxisIndex(targetSource);
              }
            }
          }
        }

        if ((!targetSource || axisIndex === -1) && lastTargetSourceIdRef.current) {
          targetSource = sources.find((item) => item.id === lastTargetSourceIdRef.current);
          if (targetSource) {
            axisIndex = getAxisIndex(targetSource);
          }
        }

        if (!targetSource) {
          targetSource = sources[0];
          axisIndex = targetSource ? getAxisIndex(targetSource) : -1;
        }

        if (!targetSource || axisIndex === -1) {
          return;
        }

        lastTargetSourceIdRef.current = targetSource.id;

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

        const currentIndex = selections[0]?.[axisIndex] ?? 0;
        const nextIndex = Math.min(Math.max(currentIndex + delta, 0), maxIndex);
        if (nextIndex === currentIndex) {
          return;
        }

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

        const resolvedTarget = targetSource;

        set(sourceInfoAtom, (prev: typeof sources) =>
          prev.map((item) => {
            if (item.id !== resolvedTarget.id) {
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
      [viewport, deckRef],
    ),
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const lower = event.key.toLowerCase();
      if (lower === "z" || lower === "t") {
        event.preventDefault();
        event.stopPropagation();
        updateAxisScrollKey(lower as Axis);
        return; // set when pressing the key
      }

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        const axis = axisScrollKeyRef.current;
        if (!axis) {
          return; // only respond when an axis key is active
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          return; // suppress vertical arrows when an axis key is active
        }
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        event.preventDefault();
        event.stopPropagation();
        void adjustAxis({ axis, delta });
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const lower = event.key.toLowerCase();
      if (lower === "z" || lower === "t") {
        event.preventDefault();
        event.stopPropagation();
        if (axisScrollKeyRef.current === lower) {
          updateAxisScrollKey(null);
        }
      } // reset when letting go of the key
    };

    const handleBlur = () => {
      // reset when switching windows
      updateAxisScrollKey(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleBlur);
    };
  }, [adjustAxis, updateAxisScrollKey]);

  React.useEffect(() => {
    // reset accumulator when axis key changes
    axisScrollAccumulatorRef.current = 0;
    void axisScrollKey;
  }, [axisScrollKey]);

  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
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

      event.preventDefault();
      event.stopPropagation();

      axisScrollAccumulatorRef.current += event.deltaY;
      const steps = Math.trunc(axisScrollAccumulatorRef.current / AXIS_SCROLL_STEP_DELTA);
      if (steps === 0) {
        return;
      }

      axisScrollAccumulatorRef.current -= steps * AXIS_SCROLL_STEP_DELTA;

      const pointer = { x, y };
      void adjustAxis({ axis: axisScrollKey, delta: -steps, pointer });
    },
    [axisScrollKey, viewport, deckRef, adjustAxis],
  );

  React.useEffect(() => {
    // attach wheel listener to deck canvas
    const deckInstance = (viewport ?? deckRef.current?.deck ?? null) as { canvas?: HTMLCanvasElement } | null;
    const element = deckInstance?.canvas;
    if (!element) {
      return;
    }

    const listener = (event: WheelEvent) => {
      handleWheel(event);
    };

    element.addEventListener("wheel", listener, { passive: false });
    return () => {
      element.removeEventListener("wheel", listener);
    };
  }, [viewport, handleWheel, deckRef]);
}
