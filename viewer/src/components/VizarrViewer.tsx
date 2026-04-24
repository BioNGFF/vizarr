import { Info } from "@mui/icons-material";
import { ThemeProvider } from "@mui/material";
import { Box, Link, Typography } from "@mui/material";
import { type PrimitiveAtom, Provider, atom, useAtomValue, useSetAtom } from "jotai";
import React, { useId } from "react";
import { getSourceDataError, sourceDataValid, writeUserErrorMessage } from "../error";
import { ViewStateContext } from "../hooks";
import { loadSources } from "../io";
import type { OmeColor } from "../layers/label-layer";
import {
  type ImageLayerConfig,
  type ViewState,
  redirectObjAtom,
  sourceErrorAtom,
  sourceInfoAtom,
  sourceWarningAtom,
  viewStateAtom,
} from "../state";
import theme from "../theme";
import Menu from "./Menu";
import { InfoSnackbar } from "./Snackbar";
import Viewer from "./Viewer";

export interface VizarrViewerProps {
  sources?: string[];
  viewState?: ViewState;
  onViewStateChange?: (viewState: ViewState) => void;
  labelColours?: OmeColor[][];
}

function VizarrViewerComponent({
  sources = [],
  viewState: initialViewState,
  onViewStateChange,
  labelColours,
}: VizarrViewerProps) {
  const setSourceInfo = useSetAtom(sourceInfoAtom);
  const setViewStateAtom = useSetAtom(viewStateAtom);
  const sourceError = useAtomValue(sourceErrorAtom);
  const redirectObj = useAtomValue(redirectObjAtom);
  const setSourceError = useSetAtom(sourceErrorAtom);
  const sourceWarning = useAtomValue(sourceWarningAtom);

  if (initialViewState) {
    setViewStateAtom(initialViewState);
  }

  const viewStateAtomWithEffect: PrimitiveAtom<ViewState | null> = atom(
    (get) => get(viewStateAtom),
    (get, set, update) => {
      const viewState = typeof update === "function" ? update(get(viewStateAtom)) : update;
      if (viewState) {
        onViewStateChange?.({
          target: viewState.target,
          zoom: viewState.zoom,
        });
        set(viewStateAtom, update);
      }
    },
  );

  React.useEffect(() => {
    loadSources(sources, labelColours).then((results) => {
      if (!sourceDataValid(results)) {
        setSourceError(writeUserErrorMessage(getSourceDataError(results)));
      }
      let sourceDatas = [];
      for (const res of results) {
        if (res.status === "fulfilled") {
          sourceDatas.push(res.value);
        } else {
          console.error(res.reason);
        }
      }
      const sourceData = sourceDatas.filter((s) => s !== null);
      setSourceInfo(sourceData);
    });
  }, [sources, labelColours, setSourceInfo, setSourceError]);

  return (
    <>
      {redirectObj === null && (
        <ViewStateContext.Provider value={viewStateAtomWithEffect}>
          <Menu />
          <Viewer />
        </ViewStateContext.Provider>
      )}
      {sourceError !== null && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            textAlign: "center",
            justifyContent: "center",
            fontSize: "120%",
          }}
        >
          <p>
            {" "}
            Sorry, we were unable to load this image due to the following error: <br /> <br /> {sourceError} <br />{" "}
            <br /> If you believe this is an error with our application, please open an issue:{" "}
            <a href="https://github.com/BioNGFF/vizarr/issues "> here </a>
          </p>
        </Box>
      )}
      {sourceWarning.length &&
        sourceWarning.map((warning, index) => {
          return <InfoSnackbar message={warning} key={useId()} />;
        })}
      {redirectObj !== null && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            textAlign: "center",
            justifyContent: "center",
            fontSize: "120%",
          }}
        >
          <Typography variant="h5">
            {redirectObj.message}
            <Link href={redirectObj.url}> {redirectObj.url} </Link>
          </Typography>
        </Box>
      )}
    </>
  );
}

export default function VizarrViewer(props: VizarrViewerProps) {
  return (
    <ThemeProvider theme={theme}>
      <Provider>
        <VizarrViewerComponent {...props} />
      </Provider>
    </ThemeProvider>
  );
}
