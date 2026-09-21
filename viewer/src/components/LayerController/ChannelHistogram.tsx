import React from "react";

import { barsToStepPath, normalizeBars, resampleHistogram } from "../../histogram";
import { useLayerState } from "../../hooks";
import { useChannelHistogram } from "../../hooks/useChannelHistogram";

/**
 * Drawn in viewBox units and stretched to the grid cell, so the sparkline lines
 * up with the slider rail without hardcoding a pixel width.
 */
const VB_WIDTH = 1000;
const VB_HEIGHT = 100;

/** Rendered height in CSS pixels. Identical for the loaded and empty states. */
const HEIGHT = 26;

/** Roughly one bar per CSS pixel across the ~165px channel column. */
const BARS = 165;

const SURFACE = "rgba(255, 255, 255, 0.05)";
/**
 * The full distribution is a recessive neutral track rather than a tinted one:
 * at low alpha the blue channel (#0000FF) is effectively invisible against the
 * panel's near-black background. Channel color is reserved for the fill.
 */
const TRACK = "rgba(255, 255, 255, 0.28)";

/**
 * Intensity distribution behind a channel's contrast slider.
 *
 * The distribution is binned once per selection; the contrast limits only move
 * a clip rect, so dragging the slider recomputes nothing.
 */
function ChannelHistogram({ channelIndex }: { channelIndex: number }) {
  const [layer] = useLayerState();
  const { histogram, status } = useChannelHistogram(channelIndex);
  const clipId = React.useId();

  const lp = layer.layerProps;
  const [rangeMin, rangeMax] = lp.contrastLimitsRange[channelIndex] ?? [0, 1];
  const [limitMin, limitMax] = lp.contrastLimits[channelIndex] ?? [0, 1];
  // Match the slider's own color expression, including the colormap override.
  const color = `rgb(${lp.colormap ? [255, 255, 255] : lp.colors[channelIndex]})`;
  const visible = lp.channelsVisible[channelIndex];
  const scale = layer.histogramScale;

  const path = React.useMemo(() => {
    if (!histogram || histogram.total === 0) return null;
    const bars = resampleHistogram(histogram, [rangeMin, rangeMax], BARS);
    return barsToStepPath(normalizeBars(bars, scale), VB_WIDTH, VB_HEIGHT);
  }, [histogram, rangeMin, rangeMax, scale]);

  // Guard a degenerate slider domain; MUI already renders NaN positions there.
  const span = rangeMax - rangeMin || 1;
  const toX = (v: number) => Math.min(VB_WIDTH, Math.max(0, ((v - rangeMin) / span) * VB_WIDTH));
  const clipLeft = toX(limitMin);
  const clipWidth = Math.max(0, toX(limitMax) - clipLeft);

  return (
    <div style={{ width: "100%", height: HEIGHT, lineHeight: 0, opacity: visible ? 1 : 0.4 }}>
      <svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
        role="presentation"
      >
        <rect x={0} y={0} width={VB_WIDTH} height={VB_HEIGHT} fill={SURFACE} />
        {path && status === "ready" && (
          <>
            {/* Fills only: non-uniform scaling would distort any stroke. */}
            <path d={path} fill={TRACK} />
            <clipPath id={clipId}>
              <rect x={clipLeft} y={0} width={clipWidth} height={VB_HEIGHT} />
            </clipPath>
            <path d={path} fill={color} fillOpacity={0.95} clipPath={`url(#${clipId})`} />
          </>
        )}
      </svg>
    </div>
  );
}

export default ChannelHistogram;
