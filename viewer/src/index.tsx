export { version } from "../../package.json";
export { default as theme } from "./theme";

export { default as Vizarr } from "./components/VizarrViewer";
export type { VizarrViewerProps } from "./components/VizarrViewer";

export { createViewer } from "./api";
export type { VizarrViewer } from "./api";

export type { ViewState, ImageLayerConfig } from "./state";

// ROI-related atoms & hooks — used by the @biongff/roi-selector plugin
export { roiDrawStateAtom, currentZInfoAtom, viewportAtom, savedRoisAtom, pendingRoiAtom, ROI_COLORS, setZSliceAtom } from "./state";
export type { RoiDrawState, SavedRoi, PendingRoi } from "./state";
export { useViewState, ViewStateContext } from "./hooks";
