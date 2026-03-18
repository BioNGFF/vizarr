import { type ViewState, Vizarr } from "@biongff/vizarr";
import debounce from "just-debounce-it";
import * as React from "react";

/**
 * `__ROI_AVAILABLE__` is a compile-time constant injected by Vite based on
 * whether `roi-selector` is active in pnpm-workspace.yaml.
 * When disabled, the import is dead-code-eliminated in production builds;
 * in dev mode the `optionalDeps` Vite plugin stubs the module.
 */
const LazyRoiSelector = __ROI_AVAILABLE__
  ? React.lazy(() => import("@biongff/roi-selector").then((m) => ({ default: m.RoiSelector })))
  : null;

class RoiErrorBoundary extends React.Component<React.PropsWithChildren> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[ROI Selector]", error);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

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

  // Add ?roi=0 param when ROI plugin is compiled in but param is missing.
  React.useEffect(() => {
    if (!__ROI_AVAILABLE__) return;
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
      enableRoi: __ROI_AVAILABLE__ && searchParams.get("roi") === "1",
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

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "black" }}>
      <Vizarr sources={sources} viewState={viewState} onViewStateChange={handleViewStateChange}>
        {enableRoi && LazyRoiSelector && (
          <RoiErrorBoundary>
            <React.Suspense fallback={null}>
              <LazyRoiSelector />
            </React.Suspense>
          </RoiErrorBoundary>
        )}
      </Vizarr>
    </div>
  );
}
