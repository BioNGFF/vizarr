import { Info } from "@mui/icons-material";
import { ThemeProvider } from "@mui/material";
import { Box, Link, Typography } from "@mui/material";
import type { Layer } from "deck.gl";
import { type PrimitiveAtom, Provider, atom, useAtomValue, useSetAtom } from "jotai";
import React from "react";
import { getSourceDataError, sourceDataValid, writeUserErrorMessage } from "../error";
import { ViewStateContext, useViewState } from "../hooks";
import { loadSources } from "../io";
import type { OmeColor } from "../layers/label-layer";
import {
  type ViewState,
  type ViewportSize,
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
  sources?: string[];
  viewState?: ViewState;
  onViewStateChange?: (viewState: ViewState) => void;
  onViewerStateChange?: (info: ViewerInfo) => void;
  /** Label colours per source, indexed in parallel with `sources`. */
  labelColours?: ReadonlyArray<ReadonlyArray<OmeColor>>;
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
}: VizarrViewerProps) {
  const setSourceInfo = useSetAtom(sourceInfoAtom);
  const setViewStateAtom = useSetAtom(viewStateAtom);
  const sourceError = useAtomValue(sourceErrorAtom);
  const redirectObj = useAtomValue(redirectObjAtom);
  const setSourceError = useSetAtom(sourceErrorAtom);
  const sourceWarning = useAtomValue(sourceWarningAtom);
  const sourceInfo = useAtomValue(sourceInfoAtom);
  const setLabelColors = useSetAtom(setLabelColorsAtom);

  React.useEffect(() => {
    if (initialViewState) {
      setViewStateAtom(initialViewState);
    }
  }, [initialViewState, setViewStateAtom]);

  // Kept in a ref so the atom below never has to be rebuilt: a new atom identity on every
  // render invalidates every useViewState() consumer and re-fires onViewerStateChange,
  // which drives the host into a render loop.
  const onViewStateChangeRef = React.useRef(onViewStateChange);
  React.useEffect(() => {
    onViewStateChangeRef.current = onViewStateChange;
  }, [onViewStateChange]);

  const viewStateAtomWithEffect: PrimitiveAtom<ViewState | null> = React.useMemo(
    () =>
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
    [],
  );

  React.useEffect(() => {
    let cancelled = false;
    loadSources(sources).then((results) => {
      if (cancelled) {
        return;
      }
      if (!sourceDataValid(results)) {
        setSourceError(writeUserErrorMessage(getSourceDataError(results)));
      }
      const sourceDatas = [];
      for (const res of results) {
        if (res.status === "fulfilled") {
          sourceDatas.push(res.value);
        } else {
          console.error(res.reason);
        }
      }
      setSourceInfo(sourceDatas.filter((s) => s !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [sources, setSourceInfo, setSourceError]);

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

export default function VizarrViewer({ children, ...props }: VizarrViewerProps) {
  return (
    <ThemeProvider theme={theme}>
      <Provider>
        <VizarrViewerComponent {...props}>{children}</VizarrViewerComponent>
      </Provider>
    </ThemeProvider>
  );
}
