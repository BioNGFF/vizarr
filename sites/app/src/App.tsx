import { type ViewState, Vizarr } from "@biongff/vizarr";
import debounce from "just-debounce-it";
import * as React from "react";

/**
 * Lazy load the optional ROI selector plugin.
 * If `@biongff/roi-selector` is not installed (or substituted by the
 * optionalDeps Vite plugin), this resolves to `null` and nothing renders.
 */
const roiPromise: Promise<{ default: React.ComponentType } | null> = import("@biongff/roi-selector")
  .then((mod) => (typeof mod.RoiSelector === "function" ? { default: mod.RoiSelector } : null))
  .catch(() => null);

/** True once we know the plugin is available (resolved at module level). */
let roiAvailable = false;
roiPromise.then((m) => {
  roiAvailable = m !== null;
});

const LazyRoiSelector = React.lazy(() => roiPromise.then((m) => m ?? { default: (() => null) as unknown as React.FC }));

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

  // Re-render once we know whether the ROI plugin is available (async check).
  const [roiReady, setRoiReady] = React.useState(roiAvailable);
  React.useEffect(() => {
    if (!roiReady) {
      roiPromise.then((m) => {
        roiAvailable = m !== null;
        setRoiReady(true);
      });
    }
  }, [roiReady]);

  // Sync the `roi` URL param once we know whether the plugin is available.
  React.useEffect(() => {
    if (!roiReady) return;
    const url = new URL(window.location.href);
    if (roiAvailable) {
      if (!url.searchParams.has("roi")) {
        url.searchParams.set("roi", "0");
        window.history.replaceState(window.history.state, "", url.href);
      }
    } else {
      if (url.searchParams.has("roi")) {
        url.searchParams.delete("roi");
        window.history.replaceState(window.history.state, "", url.href);
      }
    }
  }, [roiReady]);

  const { sources, viewState, enableRoi } = React.useMemo(() => {
    const url = new URL(urlString);
    const { searchParams } = url;
    return {
      sources: searchParams.getAll("source"),
      viewState: parseViewStateFromUrl(),
      enableRoi: roiAvailable && searchParams.get("roi") === "1",
    };
  }, [urlString, roiReady]);

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

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "black" }}>
      <Vizarr sources={sources} viewState={viewState} onViewStateChange={handleViewStateChange}>
        {enableRoi && (
          <React.Suspense fallback={null}>
            <LazyRoiSelector />
          </React.Suspense>
        )}
      </Vizarr>
    </div>
  );
}
