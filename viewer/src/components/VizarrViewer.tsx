import { Info } from "@mui/icons-material";
import { ThemeProvider } from "@mui/material";
import { Box, Link, Typography } from "@mui/material";
import type { Layer } from "deck.gl";
import { type PrimitiveAtom, Provider, atom, useAtomValue, useSetAtom } from "jotai";
import React, { useId } from "react";
import { getSourceDataError, sourceDataValid, writeUserErrorMessage } from "../error";
import { type PluginLayerEntry, type ViewerPluginApi, ViewerPluginContext } from "../ViewerPluginContext";
import { ViewStateContext, useViewState } from "../hooks";
import { createSourceData } from "../io";
import {
  type ImageLayerConfig,
  type ViewState,
  currentImageBoundsAtom,
  currentTInfoAtom,
  currentZInfoAtom,
  redirectObjAtom,
  setTSliceAtom,
  setZSliceAtom,
  sourceErrorAtom,
  sourceInfoAtom,
  sourceWarningAtom,
  viewStateAtom,
  viewportAtom,
} from "../state";
import theme from "../theme";
import Menu from "./Menu";
import { InfoSnackbar } from "./Snackbar";
import Viewer from "./Viewer";

export interface VizarrViewerProps {
  sources?: string[];
  viewState?: ViewState;
  onViewStateChange?: (viewState: ViewState) => void;
  children?: React.ReactNode;
}

/**
 * Internal component that lives inside the jotai Provider + ViewStateContext.
 * It reads viewer atoms, holds plugin layer/handler registrations in useState,
 * renders <Menu/> + <Viewer/> with the collected plugin layers/handlers,
 * and exposes a ViewerPluginContext for children (plugins) to register themselves.
 */
function PluginBridge({
  onViewStateChange,
  children,
}: {
  onViewStateChange?: (viewState: ViewState) => void;
  children?: React.ReactNode;
}) {
  // ---- Read viewer state for the plugin context ----
  const imageBounds = useAtomValue(currentImageBoundsAtom);
  const zInfo = useAtomValue(currentZInfoAtom);
  const tInfo = useAtomValue(currentTInfoAtom);
  const viewport = useAtomValue(viewportAtom);
  const [viewState, setViewState] = useViewState();

  const setZSlice = useSetAtom(setZSliceAtom);
  const setTSlice = useSetAtom(setTSliceAtom);

  // ---- Plugin layer/handler registrations (keyed by plugin id) ----
  const [pluginLayerMap, setPluginLayerMap] = React.useState<Record<string, PluginLayerEntry>>({});
  const [clickHandlers, setClickHandlers] = React.useState<Record<string, (coordinate: [number, number]) => boolean>>(
    {},
  );
  const [hoverHandlers, setHoverHandlers] = React.useState<
    Record<string, (coordinate: [number, number] | null) => void>
  >({});

  // ---- Flatten plugin layers for Viewer ----
  const additionalLayers: Layer[] = React.useMemo(
    () => Object.values(pluginLayerMap).flatMap((entry) => entry.layers),
    [pluginLayerMap],
  );

  // ---- Composite cursor: first plugin with a cursor wins ----
  const pluginCursor: string | undefined = React.useMemo(() => {
    for (const entry of Object.values(pluginLayerMap)) {
      if (entry.cursor) return entry.cursor;
    }
    return undefined;
  }, [pluginLayerMap]);

  // ---- Composite click handler ----
  const handlePluginClick = React.useCallback(
    (coordinate: [number, number]): boolean => {
      for (const handler of Object.values(clickHandlers)) {
        if (handler(coordinate)) return true;
      }
      return false;
    },
    [clickHandlers],
  );

  // ---- Composite hover handler ----
  const handlePluginHover = React.useCallback(
    (coordinate: [number, number] | null): void => {
      for (const handler of Object.values(hoverHandlers)) {
        handler(coordinate);
      }
    },
    [hoverHandlers],
  );

  // ---- Build stable plugin API ----
  const stableSetViewState = React.useCallback(
    (vs: ViewState) => {
      setViewState(vs);
    },
    [setViewState],
  );

  const addLayers = React.useCallback(
    (pluginId: string, entry: PluginLayerEntry) => setPluginLayerMap((prev) => ({ ...prev, [pluginId]: entry })),
    [],
  );
  const removeLayers = React.useCallback(
    (pluginId: string) =>
      setPluginLayerMap((prev) => {
        const { [pluginId]: _, ...rest } = prev;
        return rest;
      }),
    [],
  );
  const addClickHandler = React.useCallback(
    (pluginId: string, handler: (coordinate: [number, number]) => boolean) =>
      setClickHandlers((prev) => ({ ...prev, [pluginId]: handler })),
    [],
  );
  const removeClickHandler = React.useCallback(
    (pluginId: string) =>
      setClickHandlers((prev) => {
        const { [pluginId]: _, ...rest } = prev;
        return rest;
      }),
    [],
  );
  const addHoverHandler = React.useCallback(
    (pluginId: string, handler: (coordinate: [number, number] | null) => void) =>
      setHoverHandlers((prev) => ({ ...prev, [pluginId]: handler })),
    [],
  );
  const removeHoverHandler = React.useCallback(
    (pluginId: string) =>
      setHoverHandlers((prev) => {
        const { [pluginId]: _, ...rest } = prev;
        return rest;
      }),
    [],
  );

  const pluginApi: ViewerPluginApi = React.useMemo(
    () => ({
      imageBounds,
      zInfo,
      tInfo,
      viewport,
      viewState,
      setViewState: stableSetViewState,
      setZSlice,
      setTSlice,
      addLayers,
      removeLayers,
      addClickHandler,
      removeClickHandler,
      addHoverHandler,
      removeHoverHandler,
    }),
    [
      imageBounds,
      zInfo,
      tInfo,
      viewport,
      viewState,
      stableSetViewState,
      setZSlice,
      setTSlice,
      addLayers,
      removeLayers,
      addClickHandler,
      removeClickHandler,
      addHoverHandler,
      removeHoverHandler,
    ],
  );

  return (
    <ViewerPluginContext.Provider value={pluginApi}>
      <Menu />
      <Viewer
        additionalLayers={additionalLayers}
        pluginCursor={pluginCursor}
        onPluginClick={handlePluginClick}
        onPluginHover={handlePluginHover}
      />
      {children}
    </ViewerPluginContext.Provider>
  );
}

function VizarrViewerComponent({
  sources = [],
  viewState: initialViewState,
  onViewStateChange,
  children,
}: VizarrViewerProps) {
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
          <PluginBridge onViewStateChange={onViewStateChange}>{children}</PluginBridge>
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

export default function VizarrViewer({ children, ...props }: VizarrViewerProps) {
  return (
    <ThemeProvider theme={theme}>
      <Provider>
        <VizarrViewerComponent {...props}>{children}</VizarrViewerComponent>
      </Provider>
    </ThemeProvider>
  );
}
