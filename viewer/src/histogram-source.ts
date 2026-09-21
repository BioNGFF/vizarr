/**
 * Fetching and caching of per-channel intensity histograms.
 *
 * The binning math lives in `./histogram`; this module owns the I/O policy.
 */

import QuickLRU from "quick-lru";

import { type Histogram, chooseBinCount, computeHistogram, finiteMinMax } from "./histogram";

/**
 * Structural stand-in for `ZarrPixelSource`.
 *
 * Taking the shape rather than the class keeps this layer testable: the real
 * `getRaster` defers through `requestAnimationFrame`, which does not exist in
 * the node environment the test suite runs in.
 */
export type RasterSource = {
  readonly dtype: string;
  readonly shape: ReadonlyArray<number>;
  getRaster(options: {
    selection: ReadonlyArray<number>;
  }): Promise<{ data: ArrayLike<number>; width: number; height: number }>;
};

/**
 * Planes larger than this are skipped rather than fetched.
 *
 * Multiscale images resolve to their coarsest level so they never come close,
 * but a well grid resolves to `datasets[0]` (full resolution, see `ome.ts`) and
 * would otherwise pull tens of megabytes to draw a 30px sparkline.
 */
export const MAX_HISTOGRAM_PIXELS = 4_194_304;

const CACHE = new QuickLRU<string, Histogram>({ maxSize: 64 });
const INFLIGHT = new Map<string, Promise<Histogram>>();

/**
 * Cache key for a channel's distribution.
 *
 * Deliberately derived from pixel identity alone — never from contrast limits,
 * so dragging the slider can't trigger a refetch. Keying on the selection
 * *values* rather than the channel slot also means a histogram follows its
 * channel when `ChannelOptions` removes a channel and splices the arrays.
 */
export function histogramKey(sourceId: string, selection: ReadonlyArray<number>): string {
  return `${sourceId}|${selection.join(",")}`;
}

/** Synchronously read an already-computed histogram, if one is cached. */
export function getCachedHistogram(key: string): Histogram | undefined {
  return CACHE.get(key);
}

/** True when the source's plane is small enough to bin. */
export function canComputeHistogram(source: RasterSource): boolean {
  const [height, width] = planeShape(source);
  return width * height <= MAX_HISTOGRAM_PIXELS;
}

function planeShape(source: RasterSource): [height: number, width: number] {
  const { shape } = source;
  return [shape[shape.length - 2] ?? 0, shape[shape.length - 1] ?? 0];
}

function isIntegerDtype(dtype: string): boolean {
  return dtype !== "Float32" && dtype !== "Float64";
}

/**
 * Read one plane and bin it.
 *
 * `Uint8` short-circuits to its natural fixed domain, skipping the min/max
 * pre-pass entirely. Note this cannot reuse `utils.calcDataRange`, which
 * returns `[0, 255]` for `Uint8` *without reading any pixels*.
 */
export async function computeHistogramForSelection(
  source: RasterSource,
  selection: ReadonlyArray<number>,
): Promise<Histogram> {
  const { data } = await source.getRaster({ selection });

  if (source.dtype === "Uint8") {
    return computeHistogram(data, { min: 0, max: 255, integer: true });
  }

  const integer = isIntegerDtype(source.dtype);
  const range = finiteMinMax(data);
  if (!range) {
    return computeHistogram(data, { integer });
  }

  const [min, max] = range;
  return computeHistogram(data, { min, max, integer, bins: chooseBinCount({ integer, min, max }) });
}

/**
 * Resolve a channel's histogram, sharing both the cache and any in-flight
 * request. De-duplication is required rather than merely nice: the app runs
 * under `StrictMode`, so every effect fires twice in development.
 *
 * No `AbortSignal` is threaded through on purpose — see `useChannelHistogram`.
 */
export function loadHistogram(args: {
  key: string;
  source: RasterSource;
  selection: ReadonlyArray<number>;
}): Promise<Histogram> {
  const { key, source, selection } = args;

  const cached = CACHE.get(key);
  if (cached) return Promise.resolve(cached);

  const inflight = INFLIGHT.get(key);
  if (inflight) return inflight;

  const promise = computeHistogramForSelection(source, selection)
    .then((histogram) => {
      CACHE.set(key, histogram);
      return histogram;
    })
    .finally(() => {
      INFLIGHT.delete(key);
    });

  INFLIGHT.set(key, promise);
  return promise;
}
