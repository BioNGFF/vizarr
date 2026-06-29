import { Box, Link, ThemeProvider, Typography } from "@mui/material";
import type { Layer } from "deck.gl";
import { type PrimitiveAtom, Provider, atom, useAtomValue, useSetAtom } from "jotai";
import React, { useId } from "react";
import { getSourceDataError, sourceDataValid, writeUserErrorMessage } from "../error";
import { ViewStateContext, useViewState } from "../hooks";
import { createSourceData } from "../io";
import {
  type ImageLayerConfig,
  type ViewState,
  type ViewportSize,
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

export interface ViewState {
  /**Level of zoom */
  zoom: number;
  /** Coordinates to center the view state on */
  target: [number, number];
  width?: number;
  height?: number;
}

/** Viewer state snapshot exposed to the host application via onViewerStateChange. */
export interface ViewerInfo {
  sourceUrl: string;
  imageBounds: { xMin: number; yMin: number; xMax: number; yMax: number; spatialUnit: string } | null;
  zInfo: { zValue: number; zMax: number } | null;
  tInfo: { tValue: number; tMax: number } | null;
  viewport: ViewportSize | null;
  setViewState: (vs: ViewState) => void;
  setZSlice: (z: number) => void;
  setTSlice: (t: number) => void;
}

export interface VizarrViewerProps {
  /**  Source image urls*/
  sources?: string[];
  /** View state of the viewer*/
  viewState?: ViewState;
  /** Callback to execute side effects when view state changes */
  onViewStateChange?: (viewState: ViewState) => void;
  onViewerStateChange?: (info: ViewerInfo) => void;
  additionalLayers?: Layer[];
  pluginCursor?: string;
  onPluginClick?: (coordinate: [number, number]) => boolean;
  onPluginHover?: (coordinate: [number, number] | null) => void;
  children?: React.ReactNode;
}

/**
 * Internal component that lives inside the jotai Provider + ViewStateContext.
 * It reads viewer atoms, notifies the host of viewer state changes,
 * and renders <Menu/> + <Viewer/> + children.
 */
function ViewerBridge({
  sourceUrls,
  onViewStateChange,
  onViewerStateChange,
  additionalLayers = [],
  pluginCursor,
  onPluginClick,
  onPluginHover,
  children,
}: {
  sourceUrls: string[];
  onViewStateChange?: (viewState: ViewState) => void;
  onViewerStateChange?: (info: ViewerInfo) => void;
  additionalLayers?: Layer[];
  pluginCursor?: string;
  onPluginClick?: (coordinate: [number, number]) => boolean;
  onPluginHover?: (coordinate: [number, number] | null) => void;
  children?: React.ReactNode;
}) {
  const imageBounds = useAtomValue(currentImageBoundsAtom);
  const zInfo = useAtomValue(currentZInfoAtom);
  const tInfo = useAtomValue(currentTInfoAtom);
  const viewport = useAtomValue(viewportAtom);
  const [, setViewState] = useViewState();

  const setZSlice = useSetAtom(setZSliceAtom);
  const setTSlice = useSetAtom(setTSliceAtom);

  const stableSetViewState = React.useCallback(
    (vs: ViewState) => {
      setViewState(vs);
    },
    [setViewState],
  );

  // Notify host application when viewer state changes
  React.useEffect(() => {
    onViewerStateChange?.({
      sourceUrl: sourceUrls[0] ?? "",
      imageBounds,
      zInfo,
      tInfo,
      viewport,
      setViewState: stableSetViewState,
      setZSlice,
      setTSlice,
    });
  }, [sourceUrls, imageBounds, zInfo, tInfo, viewport, stableSetViewState, setZSlice, setTSlice, onViewerStateChange]);

  return (
    <>
      <Menu />
      <Viewer
        additionalLayers={additionalLayers}
        pluginCursor={pluginCursor}
        onPluginClick={onPluginClick}
        onPluginHover={onPluginHover}
      />
      {children}
    </>
  );
}

function VizarrViewerComponent({
  sources = [],
  viewState: initialViewState,
  onViewStateChange,
  onViewerStateChange,
  additionalLayers,
  pluginCursor,
  onPluginClick,
  onPluginHover,
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
          <ViewerBridge
            sourceUrls={sources}
            onViewStateChange={onViewStateChange}
            onViewerStateChange={onViewerStateChange}
            additionalLayers={additionalLayers}
            pluginCursor={pluginCursor}
            onPluginClick={onPluginClick}
            onPluginHover={onPluginHover}
          >
            {children}
          </ViewerBridge>
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

/**
 *Component to render source images
 */
export default function VizarrViewer({ children, ...props }: VizarrViewerProps) {
  return (
    <ThemeProvider theme={theme}>
      <Provider>
        <VizarrViewerComponent {...props}>{children}</VizarrViewerComponent>
      </Provider>
    </ThemeProvider>
  );
}
