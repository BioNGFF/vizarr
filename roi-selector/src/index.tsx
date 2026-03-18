export { default as RoiSelector } from "./RoiSelector";

// Re-export ROI state for programmatic access
export {
  roiDrawStateAtom,
  savedRoisAtom,
  pendingRoiAtom,
  ROI_COLORS,
  normalizeRoiBounds,
  nextAvailableColor,
  clampToBounds,
} from "./state";
export type { RoiDrawState, SavedRoi, PendingRoi, NormalizedBounds, ImageBounds } from "./state";
