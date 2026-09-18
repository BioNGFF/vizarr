import { type ViewState, Vizarr } from "@biongff/vizarr";

import { AnndataController, AnndataProvider, type labelColor } from "@biongff/anndata-zarr";
import { RoiSelector, useRoiDeckExtension } from "@biongff/roi-selector";
import type { PendingRoi, RoiDrawState, SavedRoi, ViewerInfo } from "@biongff/roi-selector";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import debounce from "just-debounce-it";
import * as React from "react";

import "@biongff/anndata-zarr/dist/anndata-zarr.css";

const EMPTY_COLORS: labelColor[] = [];

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
  typography: {
    fontSize: 12,
  },
});

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
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <AnndataProvider>
          <div className="container-right">{anndataControllers}</div>
          <Vizarr
            sources={sources}
            viewState={viewState}
            onViewerStateChange={setViewerInfo}
            onViewStateChange={handleViewStateChange}
            additionalLayers={enableRoi ? layers : undefined}
            pluginCursor={enableRoi ? cursor : undefined}
            onPluginClick={enableRoi ? onClick : undefined}
            onPluginHover={enableRoi ? onHover : undefined}
            labelColours={labelColours}
          >
            {enableRoi && viewerInfo && (
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
          </Vizarr>
        </AnndataProvider>
      </ThemeProvider>
    </div>
  );
}
