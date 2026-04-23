/** An ROI corner. x/y are always required; z and t are present only when the image has those axes. */
export interface RoiCorner {
  x: number;
  y: number;
  z?: number;
  t?: number;
}

/**
 * Slice a RoiPoint down to an [x, y] tuple.
 * Single entry point for all 2D consumers (deck.gl polygons, viewport targeting, etc.).
 */
export function toXY(p: RoiCorner): [number, number] {
  return [p.x, p.y];
}

/**
 * Shared state for the "draw ROI on image" feature.
 *
 * State machine:
 *   null              → draw mode is OFF
 *   "waiting-first"   → draw mode ON, waiting for the first click
 *   { corner1 }       → first corner placed, waiting for second click
 */
export type RoiDrawState = null | "waiting-first" | { corner1: RoiCorner };

/** A saved ROI with its assigned overlay color. */
export interface SavedRoi {
  id: string;
  name: string;
  corner1: RoiCorner;
  corner2: RoiCorner;
  color: [number, number, number];
  visible: boolean;
}

/** A ROI that has been drawn but not yet saved or discarded. */
export interface PendingRoi {
  corner1: RoiCorner;
  corner2: RoiCorner;
}

/** Normalized bounding box with guaranteed min/max ordering. */
export interface NormalizedBounds {
  min: RoiCorner;
  max: RoiCorner;
}

/**
 * Build a deck.gl-compatible polygon from the XY extent of normalized bounds.
 * Single entry point for converting 3D bounds → 2D rectangle vertices.
 */
export function boundsToPolygonXY(bounds: NormalizedBounds): [number, number][] {
  return [
    [bounds.min.x, bounds.min.y],
    [bounds.max.x, bounds.min.y],
    [bounds.max.x, bounds.max.y],
    [bounds.min.x, bounds.max.y],
  ];
}

/*
 * Normalize a ROI's corners so that min ≤ max on every axis.
 * Optional axes (z, t) are only included when both corners carry them.
 *
 * Works for both `SavedRoi` and `PendingRoi`.
 */
export function normalizeRoiBounds(roi: {
  corner1: RoiCorner;
  corner2: RoiCorner;
}): NormalizedBounds {
  const min: RoiCorner = {
    x: Math.min(roi.corner1.x, roi.corner2.x),
    y: Math.min(roi.corner1.y, roi.corner2.y),
  };
  const max: RoiCorner = {
    x: Math.max(roi.corner1.x, roi.corner2.x),
    y: Math.max(roi.corner1.y, roi.corner2.y),
  };
  if (roi.corner1.z !== undefined && roi.corner2.z !== undefined) {
    min.z = Math.min(roi.corner1.z, roi.corner2.z);
    max.z = Math.max(roi.corner1.z, roi.corner2.z);
  }
  if (roi.corner1.t !== undefined && roi.corner2.t !== undefined) {
    min.t = Math.min(roi.corner1.t, roi.corner2.t);
    max.t = Math.max(roi.corner1.t, roi.corner2.t);
  }
  return { min, max };
}

/** Convert NormalizedBounds to string-keyed form for text fields. */
export function boundsToCoords(bounds: NormalizedBounds): Record<string, string> {
  const c: Record<string, string> = {
    x1: String(bounds.min.x),
    y1: String(bounds.min.y),
    x2: String(bounds.max.x),
    y2: String(bounds.max.y),
  };
  c.z1 = bounds.min.z !== undefined ? String(bounds.min.z) : "";
  c.z2 = bounds.max.z !== undefined ? String(bounds.max.z) : "";
  c.t1 = bounds.min.t !== undefined ? String(bounds.min.t) : "";
  c.t2 = bounds.max.t !== undefined ? String(bounds.max.t) : "";
  return c;
}

/**
 * Parse string coordinate fields back into the corner1/corner2 RoiPoint shape.
 * Returns `null` when any XY value is NaN.
 * z and t fields are included in the result only when the string is non-empty
 * (or a fallback provides them).
 */
export function coordsToRoi(
  c: Record<string, string>,
  fallback?: { corner1: RoiCorner; corner2: RoiCorner },
): { corner1: RoiCorner; corner2: RoiCorner } | null {
  const nx1 = Number(c.x1);
  const ny1 = Number(c.y1);
  const nx2 = Number(c.x2);
  const ny2 = Number(c.y2);
  if ([nx1, ny1, nx2, ny2].some(Number.isNaN)) return null;

  const corner1: RoiCorner = { x: nx1, y: ny1 };
  const corner2: RoiCorner = { x: nx2, y: ny2 };

  // z — include when string is non-empty or fallback has it
  const rawZ1 = c.z1 !== undefined && c.z1 !== "" ? Number(c.z1) : undefined;
  const rawZ2 = c.z2 !== undefined && c.z2 !== "" ? Number(c.z2) : undefined;
  const z1 = rawZ1 !== undefined ? rawZ1 : fallback?.corner1.z;
  const z2 = rawZ2 !== undefined ? rawZ2 : fallback?.corner2.z;
  if (z1 !== undefined && !Number.isNaN(z1)) corner1.z = z1;
  if (z2 !== undefined && !Number.isNaN(z2)) corner2.z = z2;

  // t — include when string is non-empty or fallback has it
  const rawT1 = c.t1 !== undefined && c.t1 !== "" ? Number(c.t1) : undefined;
  const rawT2 = c.t2 !== undefined && c.t2 !== "" ? Number(c.t2) : undefined;
  const t1 = rawT1 !== undefined ? rawT1 : fallback?.corner1.t;
  const t2 = rawT2 !== undefined ? rawT2 : fallback?.corner2.t;
  if (t1 !== undefined && !Number.isNaN(t1)) corner1.t = t1;
  if (t2 !== undefined && !Number.isNaN(t2)) corner2.t = t2;

  return { corner1, corner2 };
}

/** Spatial dimensions of the loaded image, used for bounds clamping. */
export interface ImageBounds {
  xMax: number;
  yMax: number;
}

/**
 * Clamp normalized bounds to the image boundaries so coordinates stay within
 * [0, xMax] × [0, yMax] (and [0, zMax] / [0, tMax] when those axes exist).
 */
export function clampToBounds(
  bounds: NormalizedBounds,
  image: ImageBounds,
  zMax?: number | null,
  tMax?: number | null,
): NormalizedBounds {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const min: RoiCorner = {
    x: clamp(bounds.min.x, 0, image.xMax),
    y: clamp(bounds.min.y, 0, image.yMax),
  };
  const max: RoiCorner = {
    x: clamp(bounds.max.x, 0, image.xMax),
    y: clamp(bounds.max.y, 0, image.yMax),
  };
  if (bounds.min.z !== undefined && zMax != null) {
    min.z = clamp(bounds.min.z, 0, zMax);
  } else if (bounds.min.z !== undefined) {
    min.z = bounds.min.z;
  }
  if (bounds.max.z !== undefined && zMax != null) {
    max.z = clamp(bounds.max.z, 0, zMax);
  } else if (bounds.max.z !== undefined) {
    max.z = bounds.max.z;
  }
  if (bounds.min.t !== undefined && tMax != null) {
    min.t = clamp(bounds.min.t, 0, tMax);
  } else if (bounds.min.t !== undefined) {
    min.t = bounds.min.t;
  }
  if (bounds.max.t !== undefined && tMax != null) {
    max.t = clamp(bounds.max.t, 0, tMax);
  } else if (bounds.max.t !== undefined) {
    max.t = bounds.max.t;
  }
  return { min, max };
}

/* Color palette (RGB) cycled through for multi-ROI overlays. */
export const ROI_COLORS: [number, number, number][] = [
  [255, 100, 100], // red
  [100, 180, 255], // blue
  [100, 220, 100], // green
  [255, 200, 50], // yellow
  [200, 100, 255], // purple
  [255, 150, 50], // orange
  [50, 220, 200], // teal
  [255, 100, 200], // pink
  [180, 220, 80], // lime
  [255, 130, 130], // salmon
  [130, 130, 255], // periwinkle
  [255, 180, 180], // light coral
  [80, 200, 140], // mint
  [220, 160, 255], // lavender
  [255, 220, 100], // gold
  [100, 200, 200], // cyan
];

/**
 * Generate the next default ROI name (`roi_0`, `roi_1`, …) that doesn't
 * collide with any name already used by an existing ROI.
 */
export function nextDefaultRoiName(existingRois: SavedRoi[]): string {
  const usedNames = new Set(existingRois.map((r) => r.name));
  let i = 0;
  while (usedNames.has(`roi_${i}`)) i++;
  return `roi_${i}`;
}

/*
 * Pick the first color from `ROI_COLORS` that isn't already used by any
 * existing ROI. Falls back to cycling if all colors are taken.
 */
export function nextAvailableColor(existingRois: SavedRoi[]): [number, number, number] {
  const usedSet = new Set(existingRois.map((r) => r.color.join(",")));
  for (const color of ROI_COLORS) {
    if (!usedSet.has(color.join(","))) return color;
  }
  // All colors in use — cycle based on count
  return ROI_COLORS[existingRois.length % ROI_COLORS.length];
}

/** Viewer information passed from the host application. */
export interface ViewerInfo {
  imageBounds: ImageBounds | null;
  zInfo: { zValue: number; zMax: number } | null;
  tInfo: { tValue: number; tMax: number } | null;
  viewport: { width: number; height: number } | null;
  setViewState: (vs: { zoom: number; target: [number, number]; width: number; height: number }) => void;
  setZSlice: (z: number) => void;
  setTSlice: (t: number) => void;
}
