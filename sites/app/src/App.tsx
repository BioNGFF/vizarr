import { type ViewState, type ViewerInfo, Vizarr, createLogger, theme } from "@biongff/vizarr";

import { AnndataController, AnndataProvider, type labelColor } from "@biongff/anndata-zarr";
import type { PendingRoi, RoiDrawState, SavedRoi } from "@biongff/roi-selector";
import { RoiSelector, useRoiDeckExtension } from "@biongff/roi-selector";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import debounce from "just-debounce-it";
import * as React from "react";

import "@biongff/anndata-zarr/dist/anndata-zarr.css";

const log = createLogger("vizarr:app");

const EMPTY_COLORS: labelColor[] = [];

function parseViewStateFromUrl(): ViewState | undefined {
  const url = new URL(window.location.href);
  const viewStateString = url.searchParams.get("viewState");

  if (viewStateString) {
    try {
      return JSON.parse(viewStateString);
    } catch (e) {
      log.warn("Ignoring an unparseable viewState in the URL", e);
    }
  }

  return undefined;
}

export default function App() {
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("roi")) {
      url.searchParams.set("roi", "0");
      window.history.replaceState(window.history.state, "", url.href);
    }
  }, []);

  // Read once on mount. These are inputs; the URL writes below are outputs, kept so a
  // view can be shared by link.
  const {
    sources: initialSources,
    trail: initialTrail,
    labels,
    viewState,
    enableRoi,
    tableURLs,
  } = React.useMemo(() => {
    const { searchParams } = new URL(window.location.href);
    return {
      sources: searchParams.getAll("source"),
      // Ancestors of the source, oldest first, so the breadcrumb survives a reload, the
      // browser's Back and a shared link.
      trail: searchParams.getAll("from"),
      labels: searchParams.getAll("label"),
      viewState: parseViewStateFromUrl(),
      enableRoi: searchParams.get("roi") === "1",
      tableURLs: searchParams.getAll("anndata"),
    };
  }, []);

  // Held in state rather than read from the URL on each render, so that drilling into a
  // plate and the browser's own history both have one place to change it. Re-reading the
  // URL every render would hand the viewer a new array each time and reload everything.
  const [sources, setSources] = React.useState(initialSources);
  const [trail, setTrail] = React.useState(initialTrail);

  // Record a drill-down in the URL so the view can be shared and stepped back through.
  // pushState rather than replaceState: a well is somewhere you navigated to, and Back
  // should return to the plate.
  const handleSourceChange = React.useCallback(
    (url: string, nextTrail: string[]) => {
      // Compared out here rather than inside a state updater: an updater can be invoked
      // more than once for one change, and this one writes history.
      const sameSource = sources.length === 1 && sources[0] === url;
      const sameTrail = trail.join("\u0000") === nextTrail.join("\u0000");
      if (sameSource && sameTrail) {
        return;
      }
      const next = new URL(window.location.href);
      next.searchParams.delete("source");
      next.searchParams.append("source", url);
      // The trail travels with the source: together they say where you are and how you
      // got there, which is what Back and a shared link both need.
      next.searchParams.delete("from");
      for (const step of nextTrail) {
        next.searchParams.append("from", step);
      }
      // The view belongs to the image being left; the next one fits itself.
      next.searchParams.delete("viewState");
      window.history.pushState(window.history.state, "", next.href);
      setSources([url]);
      setTrail(nextTrail);
    },
    [sources, trail],
  );

  // Follow the browser's own history, restoring the trail along with the source so the
  // breadcrumb is whole again after a Back.
  React.useEffect(() => {
    const onPopState = () => {
      const { searchParams } = new URL(window.location.href);
      const nextSources = searchParams.getAll("source");
      const nextTrail = searchParams.getAll("from");
      setSources((current) => (current.join("\u0000") === nextSources.join("\u0000") ? current : nextSources));
      setTrail((current) => (current.join("\u0000") === nextTrail.join("\u0000") ? current : nextTrail));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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

  // The viewer navigates itself when a plate is drilled into; this is how the app hears
  // about it. Only meaningful for a single source, which is what a drill-down produces.
  const navigatedTo = viewerInfo?.sourceUrl;
  const navigatedTrail = viewerInfo?.trail;
  React.useEffect(() => {
    if (navigatedTo && sources.length <= 1) {
      handleSourceChange(navigatedTo, navigatedTrail ?? []);
    }
  }, [navigatedTo, navigatedTrail, sources.length, handleSourceChange]);

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
            labels={labels}
            trail={trail}
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
