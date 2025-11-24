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

  const { sources, viewState } = React.useMemo(() => {
    const url = new URL(urlString);
    const { searchParams } = url;
    return {
      sources: searchParams.getAll("source"),
      viewState: parseViewStateFromUrl(),
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
        window.history.replaceState(window.history.state, "", decodeURIComponent(url.href));
      }, 200),
    [],
  );

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "black" }}>
      <Vizarr sources={sources} viewState={viewState} onViewStateChange={handleViewStateChange} />
    </div>
  );
}
