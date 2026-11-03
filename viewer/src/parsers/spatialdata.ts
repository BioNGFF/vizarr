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

/** The five groups a SpatialData container holds its elements in. */
export const ELEMENT_KINDS = ["images", "labels", "points", "shapes", "tables"] as const;

export type ElementKind = (typeof ELEMENT_KINDS)[number];

export interface SpatialDataElement {
  kind: ElementKind;
  /** The element's own name, which is what a user picked when they wrote it. */
  name: string;
  /** Where it sits in the container, as a path from the root. */
  path: string;
  /** Its metadata, taken from the index rather than fetched again. */
  attributes: Record<string, unknown>;
}

/** Whether a group is the root of a SpatialData container rather than an element of one. */
export function isSpatialDataRoot(attrs: object): boolean {
  return "spatialdata_attrs" in attrs && !("multiscales" in attrs) && !("ome" in attrs);
}

/**
 * A zarr v2 index keys an element by its metadata file; v3 keys it by the node. One
 * strips to the other, and nothing else in the index ends in a `.z` name.
 */
function nodePath(key: string): string {
  return key.replace(/\/\.z[a-z]+$/, "");
}

/** What an index entry holds as its attributes, which the two zarr formats disagree on. */
function attributesOf(entry: unknown, key: string): Record<string, unknown> | undefined {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }
  // v2: the entry at `<path>/.zattrs` is the attributes. v3: the entry is the node, and
  // the attributes are a field of it.
  if (key.endsWith("/.zattrs")) {
    return entry as Record<string, unknown>;
  }
  const attributes = (entry as { attributes?: unknown }).attributes;
  return attributes && typeof attributes === "object" ? (attributes as Record<string, unknown>) : undefined;
}

/**
 * The elements a consolidated index describes, in the order the index lists them.
 *
 * Consolidated metadata is not an optimisation here, it is the only way: a zarr group
 * served over HTTP cannot be asked what it contains, and a SpatialData container names
 * its elements freely. Reading the index also means every element's metadata is already
 * in hand, so choosing which to show costs no further requests.
 *
 * Entries at any other depth are ignored. An index describes every array and every group
 * beneath the elements as well, and none of those is an element.
 */
export function listSpatialDataElements(metadata: Record<string, unknown>): SpatialDataElement[] {
  const elements: SpatialDataElement[] = [];
  const seen = new Set<string>();
  for (const [key, entry] of Object.entries(metadata)) {
    const path = nodePath(key);
    const [kind, name, ...rest] = path.split("/");
    if (rest.length > 0 || !name || !ELEMENT_KINDS.includes(kind as ElementKind)) {
      continue;
    }
    const attributes = attributesOf(entry, key);
    if (!attributes || seen.has(path)) {
      continue;
    }
    seen.add(path);
    elements.push({ kind: kind as ElementKind, name, path, attributes });
  }
  return elements;
}
