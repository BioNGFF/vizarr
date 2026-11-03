import type * as zarr from "zarrita";

import { coordinateSystemsFromTransformations } from "../coordinate-systems";
import { createSourceData } from "../io";
import { log } from "../logger";
import {
  ELEMENT_KINDS,
  type ElementKind,
  type SpatialDataElement,
  listSpatialDataElements,
} from "../parsers/spatialdata";
import { MetadataError } from "../services/http";
import type { ImageLayerConfig, SourceData } from "../state";

/**
 * @module
 * Opening a SpatialData container by its root, rather than one element at a time.
 */

/** Where each zarr format keeps the index of a container's contents. */
const INDEX_KEYS = [
  // Zarr v3 keeps it inside the root node, under `consolidated_metadata`.
  { file: "zarr.json", read: (json: Record<string, unknown>) => consolidatedFromV3(json) },
  // Zarr v2 keeps it beside the root. SpatialData writes `zmetadata`, without the leading
  // dot that zarr-python's own consolidation uses, so both names are tried.
  { file: "zmetadata", read: (json: Record<string, unknown>) => consolidatedFromV2(json) },
  { file: ".zmetadata", read: (json: Record<string, unknown>) => consolidatedFromV2(json) },
] as const;

function consolidatedFromV3(json: Record<string, unknown>): Record<string, unknown> | undefined {
  const consolidated = json.consolidated_metadata;
  if (consolidated && typeof consolidated === "object" && "metadata" in consolidated) {
    return (consolidated as { metadata: Record<string, unknown> }).metadata;
  }
  return undefined;
}

function consolidatedFromV2(json: Record<string, unknown>): Record<string, unknown> | undefined {
  const metadata = json.metadata;
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : undefined;
}

/** Read one file from the store the group was opened on, or undefined if it is not there. */
async function readJson(grp: zarr.Group<zarr.Readable>, file: string): Promise<Record<string, unknown> | undefined> {
  const prefix = grp.path === "/" ? "" : grp.path;
  const bytes = await grp.store.get(`${prefix}/${file}` as `/${string}`);
  if (!bytes) {
    return undefined;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/**
 * The elements this container holds.
 *
 * Every element, of every kind, because what is not shown has to be reported as well as
 * what is: a reader who opens a Xenium sample and sees only its images should be told
 * that its points were left out, rather than left to wonder whether they are missing from
 * the file.
 */
async function readElements(grp: zarr.Group<zarr.Readable>): Promise<SpatialDataElement[]> {
  for (const { file, read } of INDEX_KEYS) {
    const json = await readJson(grp, file);
    const metadata = json && read(json);
    if (metadata) {
      log.debug("Read SpatialData index", { file, entries: Object.keys(metadata).length });
      return listSpatialDataElements(metadata);
    }
  }
  throw new MetadataError(
    "This SpatialData container has no consolidated metadata, so its elements cannot be listed. Open one directly, by its path within the container.",
    "No consolidated metadata at the SpatialData root.",
  );
}

/**
 * The space the most images agree on.
 *
 * Elements of a SpatialData container are related by nothing but their coordinate
 * systems, so showing several together means choosing one they share. The most widely
 * named wins, and ties go to the one met first, which keeps the choice stable rather than
 * dependent on how a container happens to be ordered.
 */
export function chooseSharedCoordinateSystem(elements: SpatialDataElement[]): string | undefined {
  const counts = new Map<string, number>();
  for (const element of elements) {
    const multiscales =
      (element.attributes as { ome?: { multiscales?: unknown } }).ome?.multiscales ?? // zarr v3
      (element.attributes as { multiscales?: unknown }).multiscales; // zarr v2
    if (!Array.isArray(multiscales) || multiscales.length === 0) {
      continue;
    }
    const systems = coordinateSystemsFromTransformations(multiscales[0]?.coordinateTransformations, []);
    for (const { name } of systems ?? []) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

/** What the container holds that this does not draw, phrased for a warning. */
function describeOmitted(elements: SpatialDataElement[]): string | undefined {
  const counted = ELEMENT_KINDS.filter((kind) => kind !== "images")
    .map((kind) => [kind, elements.filter((element) => element.kind === kind).length] as const)
    .filter(([, count]) => count > 0);
  if (counted.length === 0) {
    return undefined;
  }
  const parts = counted.map(([kind, count]) => `${count} ${count === 1 ? kind.replace(/s$/, "") : kind}`);
  return `This SpatialData container also holds ${parts.join(", ")}, which vizarr does not show yet.`;
}

/**
 * Every image in a SpatialData container, drawn in the space they share.
 *
 * Images only, for now. Labels are separate elements here rather than children of an
 * image, and the format is explicit that nothing links an element to another except a
 * coordinate system, so which image a labels element belongs over is a question this
 * cannot answer yet. Points and shapes are parquet, which is a different reader
 * altogether.
 */
export async function loadSpatialData(config: ImageLayerConfig, grp: zarr.Group<zarr.Readable>): Promise<SourceData[]> {
  const elements = await readElements(grp);
  const images = elements.filter((element) => element.kind === "images");
  log.debug("Opening SpatialData container", {
    source: config.source,
    elements: Object.fromEntries(ELEMENT_KINDS.map((k) => [k, elements.filter((e) => e.kind === k).length])),
  });

  if (images.length === 0) {
    throw new MetadataError(
      `This SpatialData container holds no images. It has ${summarise(elements)}, none of which vizarr can draw.`,
      "No image elements in the SpatialData container.",
    );
  }

  // Asked for, else whatever the images agree on. A container written by spatialdata-io
  // names the shared space after the sample rather than `global`, so there is nothing to
  // guess from the name alone.
  const coordinateSystem = config.coordinateSystem ?? chooseSharedCoordinateSystem(images);
  const warning = describeOmitted(elements);

  const loaded = await Promise.all(
    images.map(async (image) => {
      const sources = await createSourceData({
        ...config,
        source: `${config.source}/${image.path}`,
        coordinateSystem,
      });
      // Named for the element rather than the path, which is what the container calls it
      // and what its author chose.
      return sources.map((source) => ({ ...source, name: image.name }));
    }),
  );

  const sources = loaded.flat();
  if (warning && sources[0]) {
    sources[0] = { ...sources[0], warnings: [...(sources[0].warnings ?? []), warning] };
  }
  return sources;
}

function summarise(elements: SpatialDataElement[]): string {
  const counted = ELEMENT_KINDS.map(
    (kind: ElementKind) => [kind, elements.filter((element) => element.kind === kind).length] as const,
  ).filter(([, count]) => count > 0);
  return counted.length === 0 ? "nothing" : counted.map(([kind, count]) => `${count} ${kind}`).join(", ");
}
