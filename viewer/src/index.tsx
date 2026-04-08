export { version } from "../../package.json";
export { default as theme } from "./theme";

export { default as Vizarr } from "./components/VizarrViewer";
export type { VizarrViewerProps } from "./components/VizarrViewer";

export { createViewer } from "./api";
export type { VizarrViewer } from "./api";

export type { ViewState, ImageLayerConfig } from "./state";

// Plugin context API
export { ViewerPluginContext, useViewerPlugin } from "./ViewerPluginContext";
export type { ViewerPluginApi, PluginLayerEntry } from "./ViewerPluginContext";
export type { ViewportSize } from "./state";

export { useViewState, ViewStateContext } from "./hooks";
