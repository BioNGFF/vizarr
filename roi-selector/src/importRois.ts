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
 * Import ROIs from selected zarr tables.
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

  const importedRois: SavedRoi[] = [];
  let allRois = [...existingRois];

  for (const tableName of selectedTables) {
    try {
      const physicalRois = await readRoiTable(tablesLocation, tableName);

      for (const pRoi of physicalRois) {
        // Physical origin+length → physical corners (no conversion needed)
        const x1 = pRoi.originX;
        const y1 = pRoi.originY;
        const x2 = pRoi.originX + pRoi.lengthX;
        const y2 = pRoi.originY + pRoi.lengthY;

        // Warn about out-of-bounds
        if (
          x1 < imageBounds.xMin ||
          y1 < imageBounds.yMin ||
          x2 > imageBounds.xMax ||
          y2 > imageBounds.yMax
        ) {
          console.warn(
            `[ROI Import] "${tableName}/${pRoi.name}" extends outside image bounds ` +
              `(${x1},${y1})→(${x2},${y2}), ` +
              `image: (${imageBounds.xMin},${imageBounds.yMin})→(${imageBounds.xMax},${imageBounds.yMax}). Clamping.`,
          );
        }

        const clamp = (v: number, lo: number, hi: number) =>
          Math.max(lo, Math.min(hi, v));

        const corner1: RoiCorner = {
          x: clamp(x1, imageBounds.xMin, imageBounds.xMax),
          y: clamp(y1, imageBounds.yMin, imageBounds.yMax),
        };
        const corner2: RoiCorner = {
          x: clamp(x2, imageBounds.xMin, imageBounds.xMax),
          y: clamp(y2, imageBounds.yMin, imageBounds.yMax),
        };

        // Z axis (still index-based, no physical conversion)
        if (
          pRoi.originZ !== undefined &&
          pRoi.lengthZ !== undefined
        ) {
          const z1 = Math.round(pRoi.originZ);
          const z2 = Math.round(pRoi.originZ + pRoi.lengthZ);
          corner1.z = clamp(z1, 0, zMax ?? z1);
          corner2.z = clamp(z2, 0, zMax ?? z2);
          if (zMax != null && (z1 > zMax || z2 > zMax)) {
            console.warn(
              `[ROI Import] "${tableName}/${pRoi.name}" Z range (${z1}–${z2}) exceeds zMax (${zMax}). Clamping.`,
            );
          }
        }

        // T axis (still index-based, no physical conversion)
        if (
          pRoi.originT !== undefined &&
          pRoi.lengthT !== undefined
        ) {
          const t1 = Math.round(pRoi.originT);
          const t2 = Math.round(pRoi.originT + pRoi.lengthT);
          corner1.t = clamp(t1, 0, tMax ?? t1);
          corner2.t = clamp(t2, 0, tMax ?? t2);
          if (tMax != null && (t1 > tMax || t2 > tMax)) {
            console.warn(
              `[ROI Import] "${tableName}/${pRoi.name}" T range (${t1}–${t2}) exceeds tMax (${tMax}). Clamping.`,
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
