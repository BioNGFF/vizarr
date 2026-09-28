/**
 * Time-lapse mode (`?timelapse=1`): download one resolution level whole, decode every t
 * at the current z/c, and draw those frames un-tiled, so playback is a memory lookup.
 */
import type * as viv from "@vivjs/types";
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import { Matrix4 } from "math.gl";
import pMap from "p-map";
import type { ZarrPixelSource } from "./ZarrPixelSource";
import { localObjects } from "./lru-store";

export const MAX_BYTES = 1024 ** 3; // ponytail: fixed 1 GB cap, make configurable if asked
const CONCURRENCY = 4; // leave some of the browser's 6 HTTP/1.1 connections for interactive reads

export const timelapseModeAtom = atom(false);

export type TimelapseState = {
  level: number | null; // level being / been downloaded (null = nothing yet)
  phase: "idle" | "downloading" | "decoding" | "ready" | "error";
  loaded: number; // shards downloaded, then frames decoded
  total: number;
  error?: string;
  controller?: AbortController;
};

export const timelapseFamily = atomFamily((_id: string) =>
  atom<TimelapseState>({ level: null, phase: "idle", loaded: 0, total: 0 }),
);

/** Uncompressed size of the whole level (all t, z, c): an upper bound on memory. */
export function levelBytes(source: ZarrPixelSource) {
  const bytes = (globalThis as unknown as Record<string, { BYTES_PER_ELEMENT: number }>)[`${source.dtype}Array`]
    .BYTES_PER_ELEMENT;
  return source.shape.reduce((a, b) => a * b, bytes);
}

type V2Meta = { zarr_format?: number; shape: number[]; chunks: number[]; dimension_separator?: string };
type V3Meta = {
  zarr_format?: number;
  shape: number[];
  chunk_grid: { configuration: { chunk_shape: number[] } };
  chunk_key_encoding: { name: string; configuration?: { separator?: string } };
};

/**
 * Download every stored object (shard, or chunk if unsharded) of one level into memory.
 * Afterwards all reads of that level are served locally. Zarr v2 and v3 (OME-Zarr 0.4 and >= 0.5).
 */
export async function preload(
  source: ZarrPixelSource,
  onTotal: (n: number) => void,
  onObject: () => void,
  signal: AbortSignal,
) {
  const arr = source.array;
  const readJson = async (name: string) => {
    const raw = await Promise.resolve(arr.store.get(arr.resolve(name).path)).catch(() => undefined);
    return raw && JSON.parse(new TextDecoder().decode(raw));
  };
  // Zarr v3 (OME-Zarr >= 0.5): outer grid is the shard shape if sharded; keys "c/i/j/..."
  // Zarr v2 (OME-Zarr 0.4): outer grid is the chunk shape; keys "i.j..." (or dimension_separator)
  let shape: number[];
  let grid: number[];
  let encode: (c: number[]) => string;
  const v3: V3Meta | undefined = await readJson("zarr.json");
  if (v3?.zarr_format === 3) {
    ({ shape } = v3);
    grid = v3.chunk_grid.configuration.chunk_shape;
    const { name, configuration } = v3.chunk_key_encoding;
    const sep = configuration?.separator ?? (name === "v2" ? "." : "/");
    encode = (c) => (name === "v2" ? c.join(sep) || "0" : ["c", ...c].join(sep));
  } else {
    const v2: V2Meta | undefined = await readJson(".zarray");
    if (v2?.zarr_format !== 2) throw new Error("time-lapse: could not read zarr.json or .zarray");
    ({ shape } = v2);
    grid = v2.chunks;
    const sep = v2.dimension_separator ?? ".";
    encode = (c) => c.join(sep) || "0";
  }
  // every grid coordinate, e.g. [[0,0,0,0,0], [0,0,0,0,1], ...]
  let coords: number[][] = [[]];
  shape.forEach((n, i) => {
    const len = Math.ceil(n / grid[i]);
    coords = coords.flatMap((c) => Array.from({ length: len }, (_, j) => [...c, j]));
  });
  const keys = coords.map((c) => arr.resolve(encode(c)).path);
  localObjects.clear(); // one level in memory at a time
  onTotal(keys.length);
  await pMap(
    keys,
    async (key) => {
      // ponytail: one retry, then fail the whole pre-load loudly
      const get = () => Promise.resolve(arr.store.get(key, { signal }));
      const bytes = await get().catch(() => get());
      localObjects.set(key, bytes); // undefined = empty shard, zarrita fills with fill_value
      onObject();
    },
    { concurrency: CONCURRENCY, signal },
  );
}

/** Decoded planes per level, keyed by full-resolution selection ("t,c,z,..."). */
const frameCache = new WeakMap<ZarrPixelSource, Map<string, Promise<viv.PixelData>>>();

/** Decode one plane of the (downloaded) level, memoised. */
function decode(source: ZarrPixelSource, selection: number[]) {
  const frames = frameCache.get(source) ?? new Map<string, Promise<viv.PixelData>>();
  frameCache.set(source, frames);
  const key = selection.join(",");
  let frame = frames.get(key);
  if (!frame) {
    const zAxis = source.labels.indexOf("z");
    const sel = [...selection];
    if (zAxis !== -1) sel[zAxis] = source.recalculateZSelection(selection[zAxis], zAxis);
    frame = source.getRaster({ selection: sel });
    frame.catch(() => frames.delete(key)); // don't keep failures
    frames.set(key, frame);
  }
  return frame;
}

/** Decode every t at the given (z, c) selections, so playback is a lookup. */
export async function decodeAll(
  source: ZarrPixelSource,
  selections: number[][],
  tAxis: number,
  nT: number,
  onFrame: () => void,
  signal: AbortSignal,
) {
  frameCache.delete(source); // fresh after a new download
  for (let t = 0; t < nT; t++) {
    if (signal.aborted) throw new Error("aborted");
    await Promise.all(
      selections.map((sel) => {
        const s = [...sel];
        s[tAxis] = t;
        return decode(source, s);
      }),
    );
    onFrame();
  }
}

const frameSources = new WeakMap<ZarrPixelSource, ZarrPixelSource>();

/**
 * Pixel source for Viv's un-tiled ImageLayer, pinned to one downloaded level. Serves decoded
 * frames from memory; a response for an older selection never resolves, so Viv never draws it.
 */
export function frameSource(source: ZarrPixelSource, full: ZarrPixelSource) {
  const cached = frameSources.get(source); // stable identity, so Viv refetches only on selection change
  if (cached) return cached;
  let latest: AbortSignal | undefined;
  const wrapped = {
    labels: source.labels,
    tileSize: source.tileSize,
    dtype: source.dtype,
    meta: levelMeta(full, source), // keeps the scale bar: physical sizes per pixel of this level
    shape: source.shape,
    getRaster: async ({ selection, signal }: { selection: number[]; signal?: AbortSignal }) => {
      latest = signal;
      const data = await decode(source, selection);
      return signal === latest ? data : new Promise<never>(() => {});
    },
    getTile: () => Promise.reject(new Error("time-lapse: not tiled")),
    onTileError: () => {},
  } as unknown as ZarrPixelSource;
  frameSources.set(source, wrapped);
  return wrapped;
}

/** Full-resolution physical sizes, rescaled to one pixel of `level` (only x/y change with level). */
function levelMeta(full: ZarrPixelSource, level: ZarrPixelSource) {
  const sizes = full.meta?.physicalSizes;
  if (!sizes) return level.meta;
  const ratio = (axis: string) => full.shape[full.labels.indexOf(axis)] / level.shape[level.labels.indexOf(axis)];
  const physicalSizes = { ...sizes };
  for (const axis of ["x", "y"] as const) {
    if (sizes[axis]) physicalSizes[axis] = { ...sizes[axis], size: sizes[axis].size * ratio(axis) };
  }
  return { ...level.meta, physicalSizes };
}

/** Scale the base model matrix so a lower-resolution level covers the full-resolution extent. */
export function levelMatrix(base: Matrix4, full: ZarrPixelSource, level: ZarrPixelSource) {
  const x = full.labels.indexOf("x");
  const y = full.labels.indexOf("y");
  return new Matrix4(base).scale([full.shape[x] / level.shape[x], full.shape[y] / level.shape[y], 1]);
}
