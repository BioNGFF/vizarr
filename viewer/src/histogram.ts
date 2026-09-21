/**
 * Pure, synchronous histogram primitives.
 *
 * Deliberately free of zarr, React, and DOM imports: `ZarrPixelSource#getRaster`
 * defers through `requestAnimationFrame`, which does not exist in the default
 * vitest node environment. Keeping the binning and percentile math here means it
 * stays directly testable. Fetching lives in `./histogram-source`.
 */

/** Default number of bins for non-Uint8 data. */
export const DEFAULT_BINS = 512;

/** Quantiles used by the "auto contrast" action. */
export const DEFAULT_AUTO_CONTRAST_QUANTILES = [0.01, 0.99] as const;

/** An immutable binned intensity distribution over `[min, max]`. */
export interface Histogram {
  /** Lower edge of bin 0. */
  readonly min: number;
  /**
   * Upper edge of the last bin. For integer data this is *exclusive* — one past
   * the largest intensity — so that bins can be exactly one intensity wide.
   * Use {@link maxValue} for the largest representable sample.
   */
  readonly max: number;
  /** `(max - min) / counts.length`, or 0 when the range is degenerate. */
  readonly binWidth: number;
  readonly counts: Uint32Array;
  /** Number of finite samples binned. Excludes NaN and ±Infinity. */
  readonly total: number;
  /** True when the underlying samples are integral. */
  readonly integer: boolean;
}

/**
 * Largest sample the histogram can represent. Integer histograms carry an
 * exclusive upper edge, so this is one less than `max`.
 */
export function maxValue(hist: Histogram): number {
  return hist.integer && hist.max > hist.min ? hist.max - 1 : hist.max;
}

/**
 * Single-pass min/max ignoring NaN and ±Infinity.
 * Returns `null` when there are no finite samples.
 */
export function finiteMinMax(data: ArrayLike<number>): [min: number, max: number] | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let seen = false;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    // Rejects ±Infinity by the bounds and NaN because all its comparisons are false.
    if (v > Number.NEGATIVE_INFINITY && v < Number.POSITIVE_INFINITY) {
      seen = true;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return seen ? [min, max] : null;
}

/**
 * Pick a bin count. Integer data whose full span fits within `maxBins` gets one
 * bin per intensity, which makes percentiles exact rather than interpolated.
 */
export function chooseBinCount(options: {
  integer: boolean;
  min: number;
  max: number;
  maxBins?: number;
}): number {
  const { integer, min, max, maxBins = DEFAULT_BINS } = options;
  if (!(max > min)) return 1;
  if (integer) {
    const span = Math.round(max - min) + 1;
    if (span <= maxBins) return Math.max(1, span);
  }
  return maxBins;
}

/**
 * Bin `data` over `[min, max]`. When `min`/`max` are omitted they are derived
 * from the finite samples. A degenerate range collapses to a single bin.
 *
 * Pass `integer: true` for integral dtypes: `min`/`max` are then read as the
 * inclusive extrema and the domain is widened to `max + 1`, so that intensity
 * `max` gets a full cell of its own rather than sharing the last bin's edge.
 */
export function computeHistogram(
  data: ArrayLike<number>,
  options: { bins?: number; min?: number; max?: number; integer?: boolean } = {},
): Histogram {
  const integer = options.integer ?? false;
  let { min, max } = options;

  if (min === undefined || max === undefined) {
    const range = finiteMinMax(data);
    if (!range) {
      return { min: 0, max: 0, binWidth: 0, counts: new Uint32Array(1), total: 0, integer };
    }
    min = min ?? range[0];
    max = max ?? range[1];
  }

  // Every sample shares one value: report it truthfully as a single full bin.
  if (!(max > min) && !integer) {
    let total = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === min) total++;
    }
    return { min, max: min, binWidth: 0, counts: Uint32Array.of(total), total, integer };
  }

  // Exclusive upper edge for integers; see the `max` doc on Histogram.
  if (integer) max = max + 1;

  const requested = options.bins ?? (integer ? chooseBinCount({ integer, min, max: max - 1 }) : DEFAULT_BINS);
  const bins = Math.max(1, Math.floor(requested));
  const counts = new Uint32Array(bins);
  const binWidth = (max - min) / bins;
  const scale = bins / (max - min);
  const last = bins - 1;
  let total = 0;

  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    // Drop NaN and ±Infinity: they have no bin, and counting them would skew
    // every percentile. Finite samples outside the domain clamp to an edge bin.
    if (!(v > Number.NEGATIVE_INFINITY && v < Number.POSITIVE_INFINITY)) continue;
    total++;
    if (v <= min) {
      counts[0]++;
      continue;
    }
    if (v >= max) {
      counts[last]++;
      continue;
    }
    // `| 0` is only safe because the *scaled* value is bounded by `bins`.
    // Never apply it to a raw sample: Uint32/Int32 intensities overflow int32.
    let idx = ((v - min) * scale) | 0;
    if (idx > last) idx = last;
    counts[idx]++;
  }

  return { min, max, binWidth, counts, total, integer };
}

/**
 * Value at quantile `q` (0..1), interpolating within the straddling bin.
 * Integer-binned histograms return whole intensities.
 */
export function percentile(hist: Histogram, q: number): number {
  return percentiles(hist, [q])[0];
}

/**
 * Values at each quantile in `qs` using a single cumulative pass.
 * `qs` must be sorted ascending.
 */
export function percentiles(hist: Histogram, qs: ReadonlyArray<number>): number[] {
  const { counts, total, min, binWidth, integer } = hist;
  const top = maxValue(hist);
  const out: number[] = [];

  if (total === 0 || binWidth === 0) {
    for (let i = 0; i < qs.length; i++) out.push(min);
    return out;
  }

  let bin = 0;
  let cumBefore = 0;
  let cum = counts[0];

  for (const q of qs) {
    if (q <= 0) {
      out.push(min);
      continue;
    }
    if (q >= 1) {
      out.push(top);
      continue;
    }
    const target = q * total;
    while (cum < target && bin < counts.length - 1) {
      cumBefore = cum;
      bin++;
      cum += counts[bin];
    }
    const inBin = counts[bin];
    const frac = inBin > 0 ? Math.min(1, Math.max(0, (target - cumBefore) / inBin)) : 0;
    const value = min + (bin + frac) * binWidth;
    // Integral dtypes must not surface fractional intensities in the contrast inputs.
    out.push(integer ? Math.min(top, Math.floor(value)) : value);
  }

  return out;
}

/**
 * Area-weighted remap of `hist` onto an arbitrary display domain.
 *
 * Area weighting rather than nearest-neighbour: the store holds ~512 bins and
 * the sparkline draws ~165 bars, so sampling would drop most bins and make a
 * one-bin spike — the background mode, ubiquitous in microscopy — flicker in
 * and out. This conserves total count and runs in O(bins + outBins).
 */
export function resampleHistogram(
  hist: Histogram,
  domain: readonly [min: number, max: number],
  outBins: number,
): Float32Array {
  const n = Math.max(1, Math.floor(outBins));
  const out = new Float32Array(n);
  const [d0, d1] = domain;
  const span = d1 - d0;
  if (!(span > 0) || hist.total === 0) return out;

  const { counts, min, binWidth } = hist;

  // A degenerate histogram has no width to spread; drop it into one slice.
  if (binWidth === 0) {
    if (min >= d0 && min <= d1) {
      const idx = Math.min(n - 1, Math.floor(((min - d0) / span) * n));
      out[idx] += counts[0];
    }
    return out;
  }

  const outWidth = span / n;

  for (let i = 0; i < counts.length; i++) {
    const c = counts[i];
    if (c === 0) continue;
    const lo = min + i * binWidth;
    const hi = lo + binWidth;

    // Clip the source bin to the display domain.
    const clipLo = lo > d0 ? lo : d0;
    const clipHi = hi < d1 ? hi : d1;
    if (!(clipHi > clipLo)) continue;

    // Counts are uniform within a bin, so distribute by overlap length.
    const density = c / binWidth;
    let first = Math.floor((clipLo - d0) / outWidth);
    let lastIdx = Math.ceil((clipHi - d0) / outWidth) - 1;
    if (first < 0) first = 0;
    if (lastIdx > n - 1) lastIdx = n - 1;

    for (let j = first; j <= lastIdx; j++) {
      const sliceLo = d0 + j * outWidth;
      const sliceHi = sliceLo + outWidth;
      const overlap = Math.min(clipHi, sliceHi) - Math.max(clipLo, sliceLo);
      if (overlap > 0) out[j] += density * overlap;
    }
  }

  return out;
}

/**
 * Scale bars to 0..1 heights.
 *
 * Normalized against the in-view maximum, so heights carry no absolute count —
 * correct for a sparkline, but it means this must never grow a y-axis label.
 * `log1p` keeps count 0 at exactly 0 with no -Infinity to guard against.
 */
export function normalizeBars(bars: Float32Array, scale: "log" | "linear"): Float32Array {
  const out = new Float32Array(bars.length);
  let max = 0;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] > max) max = bars[i];
  }
  if (max <= 0) return out;

  if (scale === "log") {
    const denom = Math.log1p(max);
    for (let i = 0; i < bars.length; i++) {
      out[i] = bars[i] > 0 ? Math.log1p(bars[i]) / denom : 0;
    }
  } else {
    for (let i = 0; i < bars.length; i++) {
      out[i] = bars[i] / max;
    }
  }
  return out;
}

/**
 * Build a single closed step polygon for `heights` (0..1) inside a
 * `width` x `height` box, with y growing downward (SVG convention).
 *
 * One path beats one rect per bar: the sparkline is a decoration rendered up to
 * six times per layer, so the DOM cost matters more than the drawing model.
 */
export function barsToStepPath(heights: Float32Array, width: number, height: number): string {
  const n = heights.length;
  if (n === 0) return "";
  const step = width / n;
  // Keep a sparsely-populated bin visible instead of rounding it away.
  const minBar = height * 0.02;

  const parts: string[] = [`M0 ${height}`];
  for (let i = 0; i < n; i++) {
    const h = heights[i];
    const bar = h > 0 ? Math.max(minBar, h * height) : 0;
    const y = height - bar;
    const x0 = i * step;
    const x1 = (i + 1) * step;
    parts.push(`L${round(x0)} ${round(y)}`, `L${round(x1)} ${round(y)}`);
  }
  parts.push(`L${round(width)} ${height}`, "Z");
  return parts.join(" ");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
