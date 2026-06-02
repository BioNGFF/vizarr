export { version } from "../../package.json";
export { default as theme } from "./theme";

export { default as Vizarr } from "./components/VizarrViewer";
export type { VizarrViewerProps, ViewerInfo } from "./components/VizarrViewer";

export { createViewer } from "./api";
export type { VizarrViewer, labelColor } from "./api";

export type { ViewState, ImageLayerConfig, ViewportSize } from "./state";

export { useViewState, ViewStateContext } from "./hooks";
