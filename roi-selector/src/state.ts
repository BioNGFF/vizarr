import { atom } from "jotai";

/**
 * Shared state for the "draw ROI on image" feature.
 *
 * State machine:
 *   null              → draw mode is OFF
 *   "waiting-first"   → draw mode ON, waiting for the first click
 *   { corner1, z1 }   → first corner placed, waiting for second click
 */
export type RoiDrawState = null | "waiting-first" | { corner1: [number, number]; z1: number };
export const roiDrawStateAtom = atom<RoiDrawState>(null);

/** A saved ROI with its assigned overlay color. */
export interface SavedRoi {
  id: string;
  corner1: [number, number];
  corner2: [number, number];
  z1: number;
  z2: number;
  color: [number, number, number];
  visible: boolean;
}

/** A ROI that has been drawn but not yet saved or discarded. */
export interface PendingRoi {
  corner1: [number, number];
  corner2: [number, number];
  z1: number;
  z2: number;
}

export const savedRoisAtom = atom<SavedRoi[]>([]);
export const pendingRoiAtom = atom<PendingRoi | null>(null);

/** Normalized bounding box with guaranteed min/max ordering. */
export interface NormalizedBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  z1: number;
  z2: number;
}

/*
 * Normalize a ROI's coordinates so that (x1,y1) is the top-left and
 * (x2,y2) is the bottom-right, with z1 ≤ z2.
 *
 * Works for both `SavedRoi` and `PendingRoi` obj.
 */
export function normalizeRoiBounds(roi: {
  corner1: [number, number];
  corner2: [number, number];
  z1: number;
  z2: number;
}): NormalizedBounds {
  return {
    x1: Math.min(roi.corner1[0], roi.corner2[0]),
    y1: Math.min(roi.corner1[1], roi.corner2[1]),
    x2: Math.max(roi.corner1[0], roi.corner2[0]),
    y2: Math.max(roi.corner1[1], roi.corner2[1]),
    z1: Math.min(roi.z1, roi.z2),
    z2: Math.max(roi.z1, roi.z2),
  };
}

/** Convert NormalizedBounds to string-keyed form for text fields. */
export function boundsToCoords(b: NormalizedBounds): Record<string, string> {
  return {
    x1: String(b.x1),
    y1: String(b.y1),
    x2: String(b.x2),
    y2: String(b.y2),
    z1: String(b.z1),
    z2: String(b.z2),
  };
}

/**
 * Parse string coordinate fields into the corner1/corner2 + z1/z2 shape
 * used by SavedRoi / PendingRoi.  Returns `null` when any xy value is NaN.
 */
export function coordsToRoi(
  c: Record<"x1" | "y1" | "x2" | "y2" | "z1" | "z2", string>,
  fallbackZ?: { z1: number; z2: number },
): {
  corner1: [number, number];
  corner2: [number, number];
  z1: number;
  z2: number;
} | null {
  const nx1 = Number(c.x1);
  const ny1 = Number(c.y1);
  const nx2 = Number(c.x2);
  const ny2 = Number(c.y2);
  if ([nx1, ny1, nx2, ny2].some(Number.isNaN)) return null;
  const nz1 = c.z1 !== "" ? Number(c.z1) : (fallbackZ?.z1 ?? 0);
  const nz2 = c.z2 !== "" ? Number(c.z2) : (fallbackZ?.z2 ?? 0);
  if (Number.isNaN(nz1) || Number.isNaN(nz2)) return null;
  return {
    corner1: [nx1, ny1],
    corner2: [nx2, ny2],
    z1: nz1,
    z2: nz2,
  };
}

/** Spatial dimensions of the loaded image, used for bounds clamping. */
export interface ImageBounds {
  xMax: number;
  yMax: number;
  zMax: number | null;
}

/**
 * Clamp a normalized ROI to the image boundaries so coordinates stay within
 * [0, xMax] × [0, yMax] (and [0, zMax] when a Z axis is present).
 */
export function clampToBounds(b: NormalizedBounds, image: ImageBounds): NormalizedBounds {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    x1: clamp(b.x1, 0, image.xMax),
    y1: clamp(b.y1, 0, image.yMax),
    x2: clamp(b.x2, 0, image.xMax),
    y2: clamp(b.y2, 0, image.yMax),
    z1: image.zMax !== null ? clamp(b.z1, 0, image.zMax) : b.z1,
    z2: image.zMax !== null ? clamp(b.z2, 0, image.zMax) : b.z2,
  };
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
