import * as zarr from "zarrita";
import type { ImageBounds, RoiCorner, SavedRoi } from "./state";
import { nextAvailableColor } from "./state";

/** Metadata about a discovered ROI table. */
export interface RoiTableInfo {
  name: string;
  roiCount: number;
  type: string;
}

/** A single ROI in physical-unit coordinates (origin + length). */
interface PhysicalRoi {
  name: string;
  originX: number;
  originY: number;
  lengthX: number;
  lengthY: number;
  originZ?: number;
  lengthZ?: number;
  originT?: number;
  lengthT?: number;
}

// ---- Store helpers ----

function openZarrLocation(sourceUrl: string): zarr.Location<zarr.Readable> {
  const url = new URL(sourceUrl);
  const path = url.pathname as `/${string}`;
  url.pathname = "/";
  const store = new zarr.FetchStore(url.href);
  return new zarr.Location(store, path);
}

function resolveAttrs(attrs: zarr.Attributes): zarr.Attributes {
  if ("ome" in attrs) {
    return attrs.ome as zarr.Attributes;
  }
  return attrs;
}

// ---- Physical pixel sizes ----

interface PixelScales {
  x: number;
  y: number;
  z?: number;
  t?: number;
}

async function getPixelScales(
  location: zarr.Location<zarr.Readable>,
): Promise<PixelScales> {
  const group = await zarr.open(location, { kind: "group" });
  const attrs = resolveAttrs(group.attrs);

  if (!("multiscales" in attrs)) {
    throw new Error("Source zarr has no multiscales metadata");
  }

  const multiscales = attrs.multiscales as Array<{
    axes?: Array<string | { name: string; type?: string }>;
    datasets: Array<{
      path: string;
      coordinateTransformations?: Array<
        { type: "scale"; scale: number[] } | { type: "translation"; translation: number[] }
      >;
    }>;
  }>;

  const rawAxes = multiscales[0].axes ?? [];
  const axes = rawAxes.map((a) =>
    typeof a === "string"
      ? { name: a, type: a === "t" ? "time" : a === "c" ? "channel" : "space" }
      : a,
  );

  const xIdx = axes.findIndex((a) => a.name === "x");
  const yIdx = axes.findIndex((a) => a.name === "y");
  const zIdx = axes.findIndex((a) => a.name === "z");
  const tIdx = axes.findIndex((a) => a.name === "t");

  const transforms = multiscales[0].datasets[0]?.coordinateTransformations ?? [];

  let scaleX = 1;
  let scaleY = 1;
  let scaleZ: number | undefined;
  let scaleT: number | undefined;

  for (const tr of transforms) {
    if (tr.type === "scale") {
      if (xIdx >= 0) scaleX = tr.scale[xIdx];
      if (yIdx >= 0) scaleY = tr.scale[yIdx];
      if (zIdx >= 0) scaleZ = tr.scale[zIdx];
      if (tIdx >= 0) scaleT = tr.scale[tIdx];
    }
  }

  return {
    x: scaleX,
    y: scaleY,
    ...(scaleZ !== undefined ? { z: scaleZ } : {}),
    ...(scaleT !== undefined ? { t: scaleT } : {}),
  };
}

// ---- Column matching ----

const ORIGIN_X_PATTERNS = ["x_micrometer", "x_origin", "origin_x", "x"];
const ORIGIN_Y_PATTERNS = ["y_micrometer", "y_origin", "origin_y", "y"];
const LENGTH_X_PATTERNS = [
  "len_x_micrometer",
  "length_x",
  "x_length",
  "width",
  "len_x",
];
const LENGTH_Y_PATTERNS = [
  "len_y_micrometer",
  "length_y",
  "y_length",
  "height",
  "len_y",
];
const ORIGIN_Z_PATTERNS = ["z_micrometer", "z_origin", "origin_z", "z"];
const LENGTH_Z_PATTERNS = [
  "len_z_micrometer",
  "length_z",
  "z_length",
  "depth",
  "len_z",
];
const ORIGIN_T_PATTERNS = ["t_micrometer", "t_origin", "origin_t", "t"];
const LENGTH_T_PATTERNS = [
  "len_t_micrometer",
  "length_t",
  "t_length",
  "duration",
  "len_t",
];

function findColumnIndex(columnNames: string[], patterns: string[]): number {
  for (const pattern of patterns) {
    const idx = columnNames.findIndex(
      (c) => c.toLowerCase() === pattern.toLowerCase(),
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

// ---- Table discovery ----

/**
 * Discover ROI tables available under `/tables` in the zarr store.
 */
export async function discoverRoiTables(
  sourceUrl: string,
): Promise<RoiTableInfo[]> {
  const location = openZarrLocation(sourceUrl);

  try {
    const tablesLocation = location.resolve("tables");
    const tablesGroup = await zarr.open(tablesLocation, { kind: "group" });
    const tablesAttrs = resolveAttrs(tablesGroup.attrs);

    const tableNames: string[] =
      (tablesAttrs.tables as string[] | undefined) ?? [];

    if (tableNames.length === 0) {
      console.warn("[ROI Import] No tables listed in /tables group attributes");
      return [];
    }

    const tables: RoiTableInfo[] = [];

    for (const name of tableNames) {
      try {
        const tableGroup = await zarr.open(tablesLocation.resolve(name), {
          kind: "group",
        });
        const tableAttrs = resolveAttrs(tableGroup.attrs);
        const type = (tableAttrs.type as string) ?? "";

        let roiCount = 0;
        try {
          const obsIndex = await zarr.open(
            tablesLocation.resolve(`${name}/obs/_index`),
            { kind: "array" },
          );
          roiCount = obsIndex.shape[0];
        } catch {
          try {
            const xArr = await zarr.open(
              tablesLocation.resolve(`${name}/X`),
              { kind: "array" },
            );
            roiCount = xArr.shape[0];
          } catch {
            console.warn(
              `[ROI Import] Could not determine ROI count for table "${name}"`,
            );
          }
        }

        tables.push({ name, roiCount, type });
      } catch (err) {
        console.warn(`[ROI Import] Failed to read table "${name}":`, err);
      }
    }

    return tables;
  } catch (err) {
    console.warn("[ROI Import] Failed to open /tables group:", err);
    return [];
  }
}

// ---- Table reading (AnnData zarr format) ----

async function readRoiTable(
  tablesLocation: zarr.Location<zarr.Readable>,
  tableName: string,
): Promise<PhysicalRoi[]> {
  // Read ROI names from obs index column.
  let roiNames: string[] = [];
  try {
    const obsGroup = await zarr.open(
      tablesLocation.resolve(`${tableName}/obs`),
      { kind: "group" },
    );
    const indexColumnName = obsGroup.attrs._index as string | undefined;
    if (!indexColumnName) {
      throw new Error("obs group has no _index attribute");
    }
    const obsIndex = await zarr.open(
      tablesLocation.resolve(`${tableName}/obs/${indexColumnName}`),
      { kind: "array" },
    );
    const indexData = await zarr.get(obsIndex);
    roiNames = Array.from(indexData.data as Iterable<string>);
  } catch {
    console.warn(
      `[ROI Import] Could not read obs index for table "${tableName}", will generate names`,
    );
  }

  // Read column names from var index column (same AnnData convention as obs).
  let columnNames: string[];
  try {
    const varGroup = await zarr.open(
      tablesLocation.resolve(`${tableName}/var`),
      { kind: "group" },
    );
    const indexColumnName = varGroup.attrs._index as string | undefined;
    if (!indexColumnName) {
      throw new Error("var group has no _index attribute");
    }
    const varIndex = await zarr.open(
      tablesLocation.resolve(`${tableName}/var/${indexColumnName}`),
      { kind: "array" },
    );
    const varData = await zarr.get(varIndex);
    columnNames = Array.from(varData.data as Iterable<string>);
  } catch {
    console.warn(
      `[ROI Import] Could not read var index for table "${tableName}"`,
    );
    return [];
  }

  // Read X data matrix
  let xShape: readonly number[];
  let xFlat: ArrayLike<number>;
  try {
    const xArray = await zarr.open(
      tablesLocation.resolve(`${tableName}/X`),
      { kind: "array" },
    );
    const xData = await zarr.get(xArray);
    xShape = xData.shape;
    xFlat = xData.data as ArrayLike<number>;
  } catch {
    console.warn(
      `[ROI Import] Could not read X matrix for table "${tableName}"`,
    );
    return [];
  }

  // Identify required columns
  const oxIdx = findColumnIndex(columnNames, ORIGIN_X_PATTERNS);
  const oyIdx = findColumnIndex(columnNames, ORIGIN_Y_PATTERNS);
  const lxIdx = findColumnIndex(columnNames, LENGTH_X_PATTERNS);
  const lyIdx = findColumnIndex(columnNames, LENGTH_Y_PATTERNS);

  if (oxIdx < 0 || oyIdx < 0 || lxIdx < 0 || lyIdx < 0) {
    console.warn(
      `[ROI Import] Table "${tableName}" missing required columns. ` +
        `Found: [${columnNames.join(", ")}]. ` +
        `Need origin (x, y) and length (x, y) columns.`,
    );
    return [];
  }

  // Optional Z columns
  const ozIdx = findColumnIndex(columnNames, ORIGIN_Z_PATTERNS);
  const lzIdx = findColumnIndex(columnNames, LENGTH_Z_PATTERNS);

  // Optional T columns
  const otIdx = findColumnIndex(columnNames, ORIGIN_T_PATTERNS);
  const ltIdx = findColumnIndex(columnNames, LENGTH_T_PATTERNS);

  const nRows = xShape[0];
  const nCols = xShape[1];

  if (roiNames.length === 0) {
    roiNames = Array.from({ length: nRows }, (_, i) => `roi_${i}`);
  }

  const rois: PhysicalRoi[] = [];
  for (let i = 0; i < nRows; i++) {
    const roi: PhysicalRoi = {
      name: roiNames[i] ?? `roi_${i}`,
      originX: Number(xFlat[i * nCols + oxIdx]),
      originY: Number(xFlat[i * nCols + oyIdx]),
      lengthX: Number(xFlat[i * nCols + lxIdx]),
      lengthY: Number(xFlat[i * nCols + lyIdx]),
    };

    if (ozIdx >= 0 && lzIdx >= 0) {
      roi.originZ = Number(xFlat[i * nCols + ozIdx]);
      roi.lengthZ = Number(xFlat[i * nCols + lzIdx]);
    }

    if (otIdx >= 0 && ltIdx >= 0) {
      roi.originT = Number(xFlat[i * nCols + otIdx]);
      roi.lengthT = Number(xFlat[i * nCols + ltIdx]);
    }

    rois.push(roi);
  }

  return rois;
}

// ---- Main import function ----

/**
 * Import ROIs from selected zarr tables, converting from physical-unit
 * (origin + length) to pixel-unit (corner1, corner2) representation.
 */
export async function importRoisFromZarr(
  sourceUrl: string,
  selectedTables: string[],
  imageBounds: ImageBounds,
  existingRois: SavedRoi[],
  zMax?: number | null,
  tMax?: number | null,
): Promise<SavedRoi[]> {
  const location = openZarrLocation(sourceUrl);
  const tablesLocation = location.resolve("tables");

  const pixelSizes = await getPixelScales(location);

  const importedRois: SavedRoi[] = [];
  let allRois = [...existingRois];

  for (const tableName of selectedTables) {
    try {
      const physicalRois = await readRoiTable(tablesLocation, tableName);

      for (const pRoi of physicalRois) {
        // Convert physical origin+length → pixel corners
        const pixelX1 = Math.round(pRoi.originX / pixelSizes.x);
        const pixelY1 = Math.round(pRoi.originY / pixelSizes.y);
        const pixelX2 = Math.round(
          (pRoi.originX + pRoi.lengthX) / pixelSizes.x,
        );
        const pixelY2 = Math.round(
          (pRoi.originY + pRoi.lengthY) / pixelSizes.y,
        );

        // Warn about out-of-bounds
        if (
          pixelX1 < imageBounds.xMin ||
          pixelY1 < imageBounds.yMin ||
          pixelX2 > imageBounds.xMax ||
          pixelY2 > imageBounds.yMax
        ) {
          console.warn(
            `[ROI Import] "${tableName}/${pRoi.name}" extends outside image bounds ` +
              `(${pixelX1},${pixelY1})→(${pixelX2},${pixelY2}), ` +
              `image: (${imageBounds.xMin},${imageBounds.yMin})→(${imageBounds.xMax},${imageBounds.yMax}). Clamping.`,
          );
        }

        const clamp = (v: number, lo: number, hi: number) =>
          Math.max(lo, Math.min(hi, v));

        const corner1: RoiCorner = {
          x: clamp(pixelX1, imageBounds.xMin, imageBounds.xMax),
          y: clamp(pixelY1, imageBounds.yMin, imageBounds.yMax),
        };
        const corner2: RoiCorner = {
          x: clamp(pixelX2, imageBounds.xMin, imageBounds.xMax),
          y: clamp(pixelY2, imageBounds.yMin, imageBounds.yMax),
        };

        // Z axis conversion
        if (
          pRoi.originZ !== undefined &&
          pRoi.lengthZ !== undefined &&
          pixelSizes.z
        ) {
          const pz1 = Math.round(pRoi.originZ / pixelSizes.z);
          const pz2 = Math.round(
            (pRoi.originZ + pRoi.lengthZ) / pixelSizes.z,
          );
          corner1.z = clamp(pz1, 0, zMax ?? pz1);
          corner2.z = clamp(pz2, 0, zMax ?? pz2);
          if (zMax != null && (pz1 > zMax || pz2 > zMax)) {
            console.warn(
              `[ROI Import] "${tableName}/${pRoi.name}" Z range (${pz1}–${pz2}) exceeds zMax (${zMax}). Clamping.`,
            );
          }
        }

        // T axis conversion
        if (
          pRoi.originT !== undefined &&
          pRoi.lengthT !== undefined &&
          pixelSizes.t
        ) {
          const pt1 = Math.round(pRoi.originT / pixelSizes.t);
          const pt2 = Math.round(
            (pRoi.originT + pRoi.lengthT) / pixelSizes.t,
          );
          corner1.t = clamp(pt1, 0, tMax ?? pt1);
          corner2.t = clamp(pt2, 0, tMax ?? pt2);
          if (tMax != null && (pt1 > tMax || pt2 > tMax)) {
            console.warn(
              `[ROI Import] "${tableName}/${pRoi.name}" T range (${pt1}–${pt2}) exceeds tMax (${tMax}). Clamping.`,
            );
          }
        }

        // Skip degenerate ROIs
        if (corner1.x === corner2.x && corner1.y === corner2.y) {
          console.warn(
            `[ROI Import] "${tableName}/${pRoi.name}" has zero area, skipping.`,
          );
          continue;
        }

        const savedRoi: SavedRoi = {
          id: Math.random().toString(36).slice(2),
          name: `${tableName}/${pRoi.name}`,
          corner1,
          corner2,
          color: nextAvailableColor(allRois),
          visible: true,
        };

        importedRois.push(savedRoi);
        allRois = [...allRois, savedRoi];
      }
    } catch (err) {
      console.error(`[ROI Import] Failed to import table "${tableName}":`, err);
    }
  }

  return importedRois;
}
