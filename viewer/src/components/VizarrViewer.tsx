import { ThemeProvider } from "@mui/material";
import { Box, Link, Typography } from "@mui/material";
import { type PrimitiveAtom, Provider, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import React from "react";
import { ViewStateContext } from "../hooks";
import { createSourceData } from "../io";
import {
  type ImageLayerConfig,
  type ViewState,
  redirectObjAtom,
  sourceErrorAtom,
  sourceInfoAtom,
  viewStateAtom,
} from "../state";
import theme from "../theme";
import Menu from "./Menu";
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
      {sourceError === null && redirectObj === null && (
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
          <p>{`Error: server replied with "${sourceError}" when loading the resource`}</p>
        </Box>
      )}
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
