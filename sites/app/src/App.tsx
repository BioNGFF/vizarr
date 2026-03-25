import { type ViewState, type labelColor, Vizarr } from "@biongff/vizarr";

//@ts-ignore 
//No types provided by anndata-zarr plugin
import { AnndataProvider, AnndataController } from "@biongff/anndata-zarr"
import debounce from "just-debounce-it";
import * as React from "react";
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'


const darkTheme = createTheme({
  palette: {
    mode: 'dark',
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

  const { sources, viewState, anndatas } = React.useMemo(() => {
    const url = new URL(urlString);
    const { searchParams } = url;
    return {
      sources: searchParams.getAll("source"),
      viewState: parseViewStateFromUrl(),
      anndatas: searchParams
        .getAll('anndata')
        .map((v) => (v ? { url: v } : null)),
    };
  }, [urlString]);



  const [colors, setColors] = React.useState((): labelColor[][] => Array(sources.length).fill([]));
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
  const selectCallback = (colorData: any, i: any) => {
    setColors((prev) => {
      return prev.map((c, ci) => (ci === i ? colorData : c));
    });
  };
  const anndataControllers = React.useMemo(() => {
    return sources.map((_s, i) => {
      if (!anndatas?.[i]?.url) return null;
      return (
        <AnndataController
          key={i}
          adata={anndatas[i]}
          callback={(colorData: any) => selectCallback(colorData, i)}
        />
      );
    });
  }, [anndatas, sources]);
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AnndataProvider>
        <div className="container-right">{anndataControllers}</div>
        <Vizarr sources={sources} viewState={viewState} onViewStateChange={handleViewStateChange} labelColours={colors} />
      </AnndataProvider>
    </ThemeProvider>
  );
}
