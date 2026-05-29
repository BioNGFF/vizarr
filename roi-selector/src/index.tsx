export { default as RoiSelector } from "./RoiSelector";
export type { RoiSelectorProps } from "./RoiSelector";

export { useRoiDeckExtension } from "./useRoiDeckExtension";
export type { UseRoiDeckExtensionProps, RoiDeckExtension } from "./useRoiDeckExtension";

// Re-export ROI state utilities for programmatic access
export {
  ROI_COLORS,
  normalizeRoiBounds,
  boundsToPolygonXY,
  toXY,
  nextAvailableColor,
  clampToBounds,
} from "./state";
export type {
  RoiCorner as RoiPoint,
  RoiDrawState,
  SavedRoi,
  PendingRoi,
  NormalizedBounds,
  ImageBounds,
  ViewerInfo,
} from "./state";
