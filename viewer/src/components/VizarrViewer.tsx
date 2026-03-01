import { Info } from "@mui/icons-material";
import { ThemeProvider } from "@mui/material";
import { Box, Link, Typography } from "@mui/material";
import { type PrimitiveAtom, Provider, atom, useAtomValue, useSetAtom } from "jotai";
import { closeSnackbar } from "notistack";
import React from "react";
import { getSourceDataError, sourceDataValid, writeUserErrorMessage } from "../error";
import { ViewStateContext } from "../hooks";
import { createSourceData } from "../io";
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
import { ErrorSeverity } from "../types";
import Menu from "./Menu";
import { InfoSnackbar } from "./Snackbar";
import Viewer from "./Viewer";

export interface VizarrViewerProps {
  sources?: string[];
  viewState?: ViewState;
  onViewStateChange?: (viewState: ViewState) => void;
}

function VizarrViewerComponent({ sources = [], viewState: initialViewState, onViewStateChange }: VizarrViewerProps) {
  const setSourceInfo = useSetAtom(sourceInfoAtom);
  const setViewStateAtom = useSetAtom(viewStateAtom);
  const sourceError = useAtomValue(sourceErrorAtom);
  const redirectObj = useAtomValue(redirectObjAtom);
  const setSourceError = useSetAtom(sourceErrorAtom);
  const sourceWarning = useAtomValue(sourceWarningAtom);
  React.useEffect(() => {
    if (initialViewState) {
      setViewStateAtom(initialViewState);
    }
  }, [initialViewState, setViewStateAtom]);

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

  const [configs] = React.useState(
    sources.map((source, index) => {
      const config: ImageLayerConfig = {
        source: source,
      };
      return config;
    }),
  );

  React.useEffect(() => {
    async function loadSources() {
      const results = await Promise.allSettled(
        configs.map(async (config, index) => {
          const sourceData = await createSourceData(config);
          const id = Math.random().toString(36).slice(2);
          if (!sourceData.name) {
            sourceData.name = `image_${index}`;
          }
          return { id, ...sourceData };
        }),
      );
      let sourceDatas = [];

      if (!sourceDataValid(results)) {
        setSourceError(getSourceDataError(results));
      }

      for (const res of results) {
        if (res.status === "fulfilled") {
          sourceDatas.push(res.value);
        } else {
          console.error(res.reason);
        }
      }
      sourceDatas = sourceDatas.filter((s) => s !== null);
      setSourceInfo(sourceDatas);
    }

    loadSources();
  }, [configs, setSourceInfo]);

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
        sourceWarning.map((warning) => {
          return <InfoSnackbar message={warning}></InfoSnackbar>;
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
