/**
 * @module
 * SpatialData writes OME-NGFF, with its own suffix stamped into the version field.
 */

import { log } from "../logger";

/**
 * A version string SpatialData has marked as its own, such as `0.5-dev-spatialdata`.
 *
 * SpatialData's images and labels are OME-NGFF: the same `multiscales`, the same
 * `datasets`, the same `coordinateTransformations`. What it adds is a suffix on the
 * version, declaring that it also writes things the released specification does not
 * describe -- chiefly the named coordinate systems that relate its elements to one
 * another, which are the NGFF transformations proposal rather than any version of NGFF.
 *
 * The suffix is an honest warning and an awkward one. Read strictly it means "not 0.5",
 * and a reader that takes it strictly refuses an image it could draw perfectly well,
 * because the parts it does not understand are parts it was going to ignore anyway.
 */
const SPATIALDATA_VERSION = /^(\d+\.\d+)-dev-spatialdata$/;

/**
 * The same attributes with any SpatialData version suffix removed.
 *
 * Done here, once, rather than by teaching every schema a vendor's spelling: the schemas
 * describe OME-NGFF, and they should keep describing only that. A copy is returned, and
 * the original is returned unchanged when there was nothing to do, so this costs nothing
 * on the images that are not SpatialData's.
 *
 * Only this exact suffix is rewritten. `0.6.dev3` and anything else unrecognised still
 * fails, because an unknown version is a thing a reader should refuse rather than guess
 * at.
 */
export function normalizeSpatialDataVersions<T extends object>(attrs: T): T {
  let rewritten: string | undefined;

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value === null || typeof value !== "object") {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === "version" && typeof nested === "string") {
        const match = SPATIALDATA_VERSION.exec(nested);
        if (match) {
          rewritten = nested;
          out[key] = match[1];
          continue;
        }
      }
      out[key] = walk(nested);
    }
    return out;
  };

  const result = walk(attrs) as T;
  if (rewritten === undefined) {
    return attrs;
  }
  log.debug("Read a SpatialData element as OME-NGFF", { version: rewritten });
  return result;
}
