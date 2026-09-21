import React from "react";

import type { Histogram } from "../histogram";
import {
  type RasterSource,
  canComputeHistogram,
  getCachedHistogram,
  histogramKey,
  loadHistogram,
} from "../histogram-source";
import { useLayerState } from "../hooks";
import { resolveLoaderFromLayerProps } from "../utils";

export type HistogramStatus = "loading" | "ready" | "unavailable";

export interface ChannelHistogram {
  histogram: Histogram | null;
  status: HistogramStatus;
}

/**
 * Intensity distribution for one channel slot of the current layer.
 *
 * Computed from the coarsest pyramid level, matching what `calcDataRange`
 * already does. That makes it a downsampled approximation whose tails differ
 * from level 0 — deliberately so; reading full resolution to draw a sparkline
 * would be far too expensive.
 */
export function useChannelHistogram(channelIndex: number): ChannelHistogram {
  const [layer] = useLayerState();
  const selection = layer.layerProps.selections[channelIndex];

  const source = React.useMemo(() => {
    const resolved = resolveLoaderFromLayerProps(layer.layerProps);
    // Multiscale pyramids are ordered finest-first, so the last level is coarsest.
    const level = Array.isArray(resolved) ? resolved[resolved.length - 1] : resolved;
    return level as unknown as RasterSource | undefined;
  }, [layer.layerProps]);

  const key = source && selection ? histogramKey(layer.id, selection) : null;
  const usable = Boolean(source && key && canComputeHistogram(source));

  const [state, setState] = React.useState<ChannelHistogram>(() => {
    const cached = key ? getCachedHistogram(key) : undefined;
    if (cached) return { histogram: cached, status: "ready" };
    return { histogram: null, status: usable ? "loading" : "unavailable" };
  });

  // The selections array is rebuilt on every setLayer, so its identity is not a
  // safe effect dependency. The key already encodes its contents.
  const selectionRef = React.useRef(selection);
  selectionRef.current = selection;

  React.useEffect(() => {
    const currentSelection = selectionRef.current;
    if (!usable || !key || !source || !currentSelection) {
      setState({ histogram: null, status: "unavailable" });
      return;
    }

    const cached = getCachedHistogram(key);
    if (cached) {
      setState({ histogram: cached, status: "ready" });
      return;
    }

    setState({ histogram: null, status: "loading" });

    // Last-write-wins rather than AbortSignal: `lru-store.ts` caches the chunk
    // promise and never evicts it on rejection, so an aborted fetch would
    // permanently poison those chunks for the image renderer too. A superseded
    // request still completes and warms the cache, which helps when scrubbing
    // z back and forth.
    let stale = false;
    loadHistogram({ key, source, selection: currentSelection })
      .then((histogram) => {
        if (!stale) setState({ histogram, status: "ready" });
      })
      .catch((err) => {
        // A failed histogram must never take down the layer controller.
        console.warn("vizarr: failed to compute channel histogram", err);
        if (!stale) setState({ histogram: null, status: "unavailable" });
      });

    return () => {
      stale = true;
    };
    // Keyed on the string, never the contrast-limit arrays, so dragging the
    // slider cannot trigger a recompute.
  }, [key, source, usable]);

  return state;
}
