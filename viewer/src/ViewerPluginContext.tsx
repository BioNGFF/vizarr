import type { Layer, PickingInfo } from "deck.gl";
import * as React from "react";
import type { ViewState, ViewportSize } from "./state";

export interface PluginLayerEntry {
  layers: Layer[];
  cursor?: string;
}

export interface ViewerPluginApi {
  // ---- Read-only viewer data ----
  imageBounds: { xMax: number; yMax: number } | null;
  zInfo: { zValue: number; zMax: number } | null;
  tInfo: { tValue: number; tMax: number } | null;
  viewport: ViewportSize | null;
  viewState: ViewState | null;

  // ---- necessary callbacks ----
  setViewState: (vs: ViewState) => void;
  setZSlice: (z: number) => void;
  setTSlice: (t: number) => void;

  // ---- Plugin layer / handler registration (keyed by plugin id) ----
  addLayers: (pluginId: string, entry: PluginLayerEntry) => void;
  removeLayers: (pluginId: string) => void;
  addClickHandler: (pluginId: string, handler: (coordinate: [number, number]) => boolean) => void;
  removeClickHandler: (pluginId: string) => void;
  addHoverHandler: (pluginId: string, handler: (coordinate: [number, number] | null) => void) => void;
  removeHoverHandler: (pluginId: string) => void;
}

export const ViewerPluginContext = React.createContext<ViewerPluginApi | null>(null);

export function useViewerPlugin(): ViewerPluginApi {
  const ctx = React.useContext(ViewerPluginContext);
  if (!ctx) {
    throw new Error("useViewerPlugin must be used within a <Vizarr> component.");
  }
  return ctx;
}
