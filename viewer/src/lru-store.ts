import QuickLRU from "quick-lru";

import type * as zarr from "zarrita";

type RangeQuery =
  | {
      offset: number;
      length: number;
    }
  | {
      suffixLength: number;
    };

function normalizeKey(key: string, range?: RangeQuery) {
  if (!range) return key;
  if ("suffixLength" in range) return `${key}:-${range.suffixLength}`;
  return `${key}:${range.offset}:${range.offset + range.length - 1}`;
}

// For namespace keys
function sanitizeKey(key: `/${string}`): `/${string}` {
  if (key.split("/")[1]?.includes(":")) {
    return `/.${key}`;
  }
  return key;
}

/** Time-lapse: whole objects (shards/chunks) downloaded up front; reads of these keys never hit the network. */
export const localObjects = new Map<string, Uint8Array | undefined>();

function sliceRange(bytes: Uint8Array | undefined, range: RangeQuery) {
  if (!bytes) return undefined;
  // copy, not subarray: zarrita views the shard index as BigUint64Array, which needs an 8-aligned offset
  if ("suffixLength" in range) return bytes.slice(bytes.length - range.suffixLength);
  return bytes.slice(range.offset, range.offset + range.length);
}

export function lru<S extends zarr.Readable>(store: S, maxSize = 100) {
  const cache = new QuickLRU<string, Promise<Uint8Array | undefined>>({ maxSize });
  let getRange = store.getRange ? store.getRange.bind(store) : undefined;
  function get(...args: Parameters<S["get"]>) {
    const [key, opts] = args;
    if (localObjects.has(key)) return Promise.resolve(localObjects.get(key));
    const cacheKey = normalizeKey(key);
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const sanitizedKey = sanitizeKey(key);
    const result = Promise.resolve(store.get(sanitizedKey, opts)).catch((err) => {
      cache.delete(cacheKey);
      throw err;
    });
    cache.set(cacheKey, result);
    return result;
  }
  if (getRange) {
    const _getRange = getRange;
    getRange = (...args: Parameters<NonNullable<S["getRange"]>>) => {
      const [key, range, opts] = args;
      if (localObjects.has(key)) return Promise.resolve(sliceRange(localObjects.get(key), range));
      const cacheKey = normalizeKey(key, range);
      const cached = cache.get(cacheKey);
      if (cached) return cached;
      const sanitizedKey = sanitizeKey(key);
      const result = Promise.resolve(_getRange?.(sanitizedKey, range, opts)).catch((err) => {
        cache.delete(cacheKey);
        throw err;
      });
      cache.set(cacheKey, result);
      return result;
    };
  }
  return new Proxy(store, {
    get(target, prop, receiver) {
      if (prop === "get") return get;
      if (prop === "getRange" && getRange) return getRange;
      return Reflect.get(target, prop, receiver);
    },
  });
}
