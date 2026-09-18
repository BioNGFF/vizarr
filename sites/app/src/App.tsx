import { type ViewState, type ViewerInfo, Vizarr, theme } from "@biongff/vizarr";

import { AnndataController, AnndataProvider, type labelColor } from "@biongff/anndata-zarr";
import { RoiSelector, useRoiDeckExtension } from "@biongff/roi-selector";
import type { PendingRoi, RoiDrawState, SavedRoi } from "@biongff/roi-selector";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import debounce from "just-debounce-it";
import * as React from "react";

import "@biongff/anndata-zarr/dist/anndata-zarr.css";

const EMPTY_COLORS: labelColor[] = [];

function parseViewStateFromUrl(): ViewState | undefined {
  const url = new URL(window.location.href);
  const viewStateString = url.searchParams.get("viewState");

  if (viewStateString) {
    try {
      return JSON.parse(viewStateString);
    } catch (e) {
      console.warn("Invalid viewState in URL:", e);
    }
  }

  return undefined;
}

export default function App() {
  const urlString = window.location.href;

  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("roi")) {
      url.searchParams.set("roi", "0");
      window.history.replaceState(window.history.state, "", url.href);
    }
  }, []);

  const { sources, viewState, enableRoi, tableURLs } = React.useMemo(() => {
    const url = new URL(urlString);
    const { searchParams } = url;
    return {
      sources: searchParams.getAll("source"),
      viewState: parseViewStateFromUrl(),
      enableRoi: searchParams.get("roi") === "1",
      tableURLs: searchParams.getAll("anndata"),
    };
  }, [urlString]);

  // Keyed by source index rather than a fixed-length array, so it stays correct if the
  // number of sources in the URL changes.
  const [colorsBySource, setColorsBySource] = React.useState<Record<number, labelColor[]>>({});

  const labelColours = React.useMemo(
    () => sources.map((_source, i) => colorsBySource[i] ?? EMPTY_COLORS),
    [sources, colorsBySource],
  );

  // Debounced viewState change handler
  const handleViewStateChange = React.useMemo(
    () =>
      debounce((update: ViewState) => {
        const url = new URL(window.location.href);
        url.searchParams.set(
          "viewState",
          JSON.stringify({
            target: update.target,
            zoom: update.zoom,
          }),
        );
        window.history.replaceState(window.history.state, "", url.href);
      }, 200),
    [],
  );

  const selectCallback = React.useCallback((colorData: labelColor[], i: number) => {
    setColorsBySource((prev) => (prev[i] === colorData ? prev : { ...prev, [i]: colorData }));
  }, []);

  const anndataControllers = React.useMemo(() => {
    return sources.map((_s, i) => {
      if (!tableURLs?.[i]) return null;
      return (
        <AnndataController
          key={tableURLs[i]}
          adata={tableURLs[i]}
          callback={(colorData: labelColor[]) => selectCallback(colorData, i)}
        />
      );
    });
  }, [tableURLs, sources, selectCallback]);

  const [viewerInfo, setViewerInfo] = React.useState<ViewerInfo | null>(null);

  // ---- ROI state (lifted to app level) ----
  const [roiDrawState, setRoiDrawState] = React.useState<RoiDrawState>(null);
  const [savedRois, setSavedRois] = React.useState<SavedRoi[]>([]);
  const [pendingRoi, setPendingRoi] = React.useState<PendingRoi | null>(null);

  // ---- ROI deck.gl integration (layers, click, hover) ----
  // The viewer's toolbar owns the ROI tool; the panel and pointer handling follow it.
  const selecting = enableRoi && viewerInfo?.interactionMode === "select";

  const { layers, cursor, onClick, onHover } = useRoiDeckExtension({
    roiDrawState,
    setRoiDrawState,
    savedRois,
    pendingRoi,
    setPendingRoi,
    imageBounds: viewerInfo?.imageBounds ?? null,
    zInfo: viewerInfo?.zInfo ?? null,
    tInfo: viewerInfo?.tInfo ?? null,
  });
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "black" }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AnndataProvider>
          <div className="container-right">
            {selecting && viewerInfo && (
              <RoiSelector
                roiDrawState={roiDrawState}
                setRoiDrawState={setRoiDrawState}
                savedRois={savedRois}
                setSavedRois={setSavedRois}
                pendingRoi={pendingRoi}
                setPendingRoi={setPendingRoi}
                viewerInfo={viewerInfo}
              />
            )}
            {anndataControllers}
          </div>
          <Vizarr
            // The ThemeProvider above already covers the viewer and the plugin panels.
            theme={null}
            sources={sources}
            viewState={viewState}
            onViewerStateChange={setViewerInfo}
            onViewStateChange={handleViewStateChange}
            additionalLayers={enableRoi ? layers : undefined}
            pluginCursor={selecting ? cursor : undefined}
            // Only intercept pointer events while the select tool is active, so panning
            // stays unaffected; saved ROI layers keep rendering either way.
            onPluginClick={selecting ? onClick : undefined}
            onPluginHover={selecting ? onHover : undefined}
            labelColours={labelColours}
            enableSelectTool={enableRoi}
          />
        </AnndataProvider>
      </ThemeProvider>
    </div>
  );
}
