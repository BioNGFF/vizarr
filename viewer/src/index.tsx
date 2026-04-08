export { version } from "../../package.json";
export { default as theme } from "./theme";

export { default as Vizarr } from "./components/VizarrViewer";
export type { VizarrViewerProps } from "./components/VizarrViewer";

export { createViewer } from "./api";
export type { VizarrViewer } from "./api";

export type { ViewState, ImageLayerConfig } from "./state";

// Plugin extension system
export { deckExtensionsAtom, viewportAtom } from "./state";
export type { ViewportSize } from "./state";
export type { DeckExtension, OverlayPolygon } from "./state";

// Z-axis, T-axis and image-bounds utilities
export { currentZInfoAtom, setZSliceAtom, currentTInfoAtom, setTSliceAtom, currentImageBoundsAtom } from "./state";

export { useViewState, ViewStateContext } from "./hooks";
