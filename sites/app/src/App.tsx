import { RoiSelector, useRoiDeckExtension } from "@biongff/roi-selector";
import type { PendingRoi, RoiDrawState, SavedRoi, ViewerInfo } from "@biongff/roi-selector";
import { type ViewState, Vizarr } from "@biongff/vizarr";
import debounce from "just-debounce-it";
import * as React from "react";

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

  const { sources, viewState, enableRoi } = React.useMemo(() => {
    const url = new URL(urlString);
    const { searchParams } = url;
    return {
      sources: searchParams.getAll("source"),
      viewState: parseViewStateFromUrl(),
      enableRoi: searchParams.get("roi") === "1",
    };
  }, [urlString]);

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

  // ---- Viewer state (received from Vizarr via callback) ----
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
      <Vizarr
        sources={sources}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        onViewerStateChange={setViewerInfo}
        additionalLayers={enableRoi ? layers : undefined}
        pluginCursor={enableRoi ? cursor : undefined}
        onPluginClick={enableRoi ? onClick : undefined}
        onPluginHover={enableRoi ? onHover : undefined}
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
    </div>
  );
}
