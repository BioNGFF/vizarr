import { Box, Link, ThemeProvider, Typography } from "@mui/material";
import type { Layer } from "deck.gl";
import { type PrimitiveAtom, Provider, atom, useAtomValue, useSetAtom } from "jotai";
import React from "react";
import type { Logger } from "../api";
import {
  getSourceDataError,
  getSourceDataWarnings,
  handleError,
  sourceDataValid,
  writeUserErrorMessage,
} from "../error";
import { ViewStateContext, useViewState } from "../hooks";
import { loadSources } from "../io";
import type { OmeColor } from "../layers/label-layer";
import {
  type ViewState,
  type ViewportSize,
  addSourceWarningAtom,
  currentImageBoundsAtom,
  currentTInfoAtom,
  currentZInfoAtom,
  redirectObjAtom,
  setLabelColorsAtom,
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
import { InfoSnackbar, SnackbarHost } from "./Snackbar";
import Viewer from "./Viewer";

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
  /** Label colours per source, indexed in parallel with `sources`. */
  labelColours?: ReadonlyArray<ReadonlyArray<OmeColor>>;
  additionalLayers?: Layer[];
  pluginCursor?: string;
  onPluginClick?: (coordinate: [number, number]) => boolean;
  onPluginHover?: (coordinate: [number, number] | null) => void;
  children?: React.ReactNode;
  logger?: Logger;
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

  // Notify host application when viewer state changes
  React.useEffect(() => {
    onViewerStateChange?.({
      sourceUrl: sourceUrls[0] ?? "",
      imageBounds,
      zInfo,
      tInfo,
      viewport,
      setViewState,
      setZSlice,
      setTSlice,
    });
  }, [sourceUrls, imageBounds, zInfo, tInfo, viewport, setViewState, setZSlice, setTSlice, onViewerStateChange]);

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
  labelColours,
  additionalLayers,
  pluginCursor,
  onPluginClick,
  onPluginHover,
  children,
  logger = console,
}: VizarrViewerProps) {
  const setSourceInfo = useSetAtom(sourceInfoAtom);
  const setViewStateAtom = useSetAtom(viewStateAtom);
  const sourceError = useAtomValue(sourceErrorAtom);
  const redirectObj = useAtomValue(redirectObjAtom);
  const setSourceError = useSetAtom(sourceErrorAtom);
  const sourceWarning = useAtomValue(sourceWarningAtom);
  const sourceInfo = useAtomValue(sourceInfoAtom);
  const setLabelColors = useSetAtom(setLabelColorsAtom);
  const addSourceWarning = useSetAtom(addSourceWarningAtom);

  React.useEffect(() => {
    if (initialViewState) {
      setViewStateAtom(initialViewState);
    }
  }, [initialViewState, setViewStateAtom]);

  // Kept in a ref so the atom below never has to be rebuilt: a new atom identity on every
  // render invalidates every useViewState() consumer and re-fires onViewerStateChange,
  // which drives the host into a render loop.
  // Assigned in a layout effect so the ref is current before the browser paints, closing
  // the window in which a view state write would otherwise see the previous callback.
  const onViewStateChangeRef = React.useRef(onViewStateChange);
  React.useLayoutEffect(() => {
    onViewStateChangeRef.current = onViewStateChange;
  }, [onViewStateChange]);

  // useState rather than useMemo: React treats a useMemo cache as a hint it may discard,
  // whereas a useState initialiser is guaranteed to run exactly once. A stable atom
  // identity is the whole point here, so it needs the guarantee and not the hint.
  const [viewStateAtomWithEffect] = React.useState<PrimitiveAtom<ViewState | null>>(() =>
    atom(
      (get) => get(viewStateAtom),
      (get, set, update) => {
        const viewState = typeof update === "function" ? update(get(viewStateAtom)) : update;
        if (viewState) {
          onViewStateChangeRef.current?.({
            target: viewState.target,
            zoom: viewState.zoom,
          });
          set(viewStateAtom, update);
        }
      },
    ),
  );
  React.useEffect(() => {
    let cancelled = false;
    let reportedError = false;
    logger.debug("Loading sources");
    loadSources(sources)
      .then((results) => {
        if (cancelled) {
          return;
        }
        if (!sourceDataValid(results)) {
          const error = getSourceDataError(results);
          setSourceError(writeUserErrorMessage(error));
          reportedError = true;
          // Logs and rethrows, which the .catch below handles; nothing after this runs.
          handleError(error, logger);
        }
        // One source url can yield several images (a v0.6 scene), so results are flattened.
        const sourceDatas = [];
        for (const res of results) {
          if (res.status === "fulfilled") {
            sourceDatas.push(...res.value);
          } else {
            logger.error(String(res.reason));
          }
        }
        const loaded = sourceDatas.filter((s) => s !== null);
        for (const sourceData of loaded) {
          for (const warning of getSourceDataWarnings(sourceData)) {
            addSourceWarning(warning);
          }
        }
        setSourceInfo(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled || reportedError) {
          return;
        }
        const error = err instanceof Error ? err : Error(String(err));
        setSourceError(writeUserErrorMessage(error));
        logger.error(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sources, setSourceInfo, setSourceError, addSourceWarning, logger]);

  // Recolouring is applied to the loaded layer state, so it must also run once the
  // sources themselves arrive (colours can be selected before the image has loaded).
  React.useEffect(() => {
    if (!sourceInfo.length) {
      return;
    }
    setLabelColors(labelColours);
  }, [labelColours, sourceInfo, setLabelColors]);

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
      <SnackbarHost />
      {sourceWarning.map((warning) => (
        <InfoSnackbar message={warning} key={warning} />
      ))}
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
