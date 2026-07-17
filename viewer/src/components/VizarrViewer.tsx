import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Button, Link, Paper, ThemeProvider, Typography } from "@mui/material";
import { type PrimitiveAtom, Provider, atom, useAtomValue, useSetAtom } from "jotai";
import React, { useId } from "react";
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
        setSourceError(writeUserErrorMessage(getSourceDataError(results)));
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
  }, [configs, setSourceInfo, setSourceError]);
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
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
          }}
        >
          <Paper
            elevation={4}
            sx={{
              maxWidth: 480,
              width: "100%",
              p: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              textAlign: "center",
              borderTop: "3px solid",
              borderColor: "error.main",
            }}
          >
            <ErrorOutlineIcon color="error" sx={{ fontSize: 40 }} />
            <Typography variant="h6" fontWeight={600}>
              Failed to load image
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                bgcolor: "rgba(255,255,255,0.05)",
                borderRadius: 1,
                px: 2,
                py: 1.5,
                width: "100%",
                wordBreak: "break-word",
                textAlign: "left",
              }}
            >
              {sourceError}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              endIcon={<OpenInNewIcon />}
              href="https://github.com/BioNGFF/vizarr/issues"
              target="_blank"
              rel="noopener noreferrer"
              component="a"
            >
              Open an issue
            </Button>
          </Paper>
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
