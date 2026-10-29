import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Button, Link, Paper, ThemeProvider, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import type { Layer } from "deck.gl";
import { type PrimitiveAtom, Provider, atom, useAtomValue, useSetAtom } from "jotai";
import React from "react";
import { getSourceDataError, getSourceDataWarnings, sourceDataValid, writeUserErrorMessage } from "../error";
import { ViewStateContext, useViewState } from "../hooks";
import { loadSources } from "../io";
import type { OmeColor } from "../layers/label-layer";
import type { Logger } from "../logger";
import { log, setLogger } from "../logger";
import {
  type InteractionMode,
  type ViewState,
  type ViewportSize,
  addSourceWarningAtom,
  beginLoadAtom,
  currentImageBoundsAtom,
  currentTInfoAtom,
  currentZInfoAtom,
  decodeNavigationStep,
  encodeNavigationStep,
  endLoadAtom,
  interactionModeAtom,
  isLoadingAtom,
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
import defaultTheme from "../theme";
import { REPOSITORY_URL } from "../utils";
import LoadingIndicator from "./LoadingIndicator";
import Menu from "./Menu";
import { InfoSnackbar, SnackbarHost } from "./Snackbar";
import Viewer from "./Viewer";

/** Viewer state snapshot exposed to the host application via onViewerStateChange. */
export interface ViewerInfo {
  /**
   * The source currently on screen, which drilling into a plate changes. Falls back to
   * the first url the host supplied until something has loaded.
   */
  sourceUrl: string;
  imageBounds: { xMin: number; yMin: number; xMax: number; yMax: number; spatialUnit: string } | null;
  zInfo: { zValue: number; zMax: number } | null;
  tInfo: { tValue: number; tMax: number } | null;
  viewport: ViewportSize | null;
  setViewState: (vs: ViewState) => void;
  setZSlice: (z: number) => void;
  setTSlice: (t: number) => void;
  /** Pointer tool selected in the viewer toolbar; plugins implement the behaviour. */
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  /**
   * Whether any source is still loading. Reported so a host can show its own treatment;
   * the viewer already shows a quiet indicator of its own.
   */
  isLoading: boolean;
  /**
   * Ancestors of the source on screen, oldest first, in the form the `trail` prop takes.
   * A host that mirrors this into its URL keeps Back, refresh and sharing working.
   */
  trail: string[];
}

export interface VizarrViewerProps {
  /**  Source image urls*/
  sources?: string[];
  labels?: string[];
  /**
   * Ancestors of the source, oldest first, as `encodeNavigationStep` writes them.
   *
   * Drilling into a plate records where it came from, but that trail lives in the viewer
   * and so cannot survive a reload, the browser's Back, or a shared link. A host that
   * keeps the trail in its URL hands it back here, and the breadcrumb is whole again.
   */
  trail?: string[];
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
  /**
   * Show the toolbar's pan/select tools. Off by default: the select tool only does
   * something when a plugin acts on `interactionMode`, and a button that looks
   * enabled but does nothing is worse than no button.
   */
  enableSelectTool?: boolean;
  /**
   * Theme for the viewer and anything rendered inside it, defaulting to vizarr's own.
   *
   * Pass `null` when the host application already has a ThemeProvider: the viewer then
   * inherits it instead of nesting a second provider. Nesting one silently overrides the
   * host's styling for this subtree, so sibling UI outside the viewer resolves a
   * different theme and the two stop matching.
   */
  theme?: Theme | null;
}

/**
 * Internal component that lives inside the jotai Provider + ViewStateContext.
 * It reads viewer atoms, notifies the host of viewer state changes,
 * and renders <Menu/> + <Viewer/> + children.
 */
function ViewerBridge({
  sourceUrls,
  trail,
  onViewStateChange,
  onViewerStateChange,
  additionalLayers = [],
  pluginCursor,
  onPluginClick,
  onPluginHover,
  enableSelectTool,
  children,
}: {
  sourceUrls: string[];
  /** The trail the host supplied, reported back until a load replaces it. */
  trail: string[];
  onViewStateChange?: (viewState: ViewState) => void;
  onViewerStateChange?: (info: ViewerInfo) => void;
  additionalLayers?: Layer[];
  pluginCursor?: string;
  onPluginClick?: (coordinate: [number, number]) => boolean;
  onPluginHover?: (coordinate: [number, number] | null) => void;
  enableSelectTool?: boolean;
  children?: React.ReactNode;
}) {
  const imageBounds = useAtomValue(currentImageBoundsAtom);
  const zInfo = useAtomValue(currentZInfoAtom);
  const tInfo = useAtomValue(currentTInfoAtom);
  const viewport = useAtomValue(viewportAtom);
  const [, setViewState] = useViewState();
  const setZSlice = useSetAtom(setZSliceAtom);
  const setTSlice = useSetAtom(setTSliceAtom);
  const interactionMode = useAtomValue(interactionModeAtom);
  const setInteractionMode = useSetAtom(interactionModeAtom);
  const sourceError = useAtomValue(sourceErrorAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const sourceInfo = useAtomValue(sourceInfoAtom);
  // Reported from what is loaded rather than from the props, so a host following along
  // -- the ROI plugin looks up its tables by this -- sees the well, not the plate it
  // was reached from.
  const currentSourceUrl = sourceInfo.find((entry) => typeof entry.config?.source === "string")?.config?.source;
  // Until something has loaded there is no history to report, and reporting none would
  // tell a host its URL trail was wrong -- which would wipe the trail that URL arrived
  // with. Once loaded, the entry's own history is the truth, empty included.
  const loadedEntry = sourceInfo.find((entry) => typeof entry.config?.source === "string");
  const currentTrail = loadedEntry ? (loadedEntry.history ?? []).map(encodeNavigationStep) : trail;
  // Compared by value so a host effect watching it is not woken by a new empty array.
  const reportedTrail = useStableArray(currentTrail);
  // Both overlays imply nothing is on screen: an error is only set when every source
  // failed, and no urls means nothing was asked for.
  const nothingToShow = sourceUrls.length === 0 || sourceError !== null;

  // Notify host application when viewer state changes
  React.useEffect(() => {
    onViewerStateChange?.({
      sourceUrl: (typeof currentSourceUrl === "string" ? currentSourceUrl : undefined) ?? sourceUrls[0] ?? "",
      imageBounds,
      zInfo,
      tInfo,
      viewport,
      setViewState,
      setZSlice,
      setTSlice,
      interactionMode,
      setInteractionMode,
      isLoading,
      trail: reportedTrail,
    });
  }, [
    sourceUrls,
    currentSourceUrl,
    imageBounds,
    zInfo,
    tInfo,
    viewport,
    setViewState,
    setZSlice,
    setTSlice,
    interactionMode,
    setInteractionMode,
    isLoading,
    reportedTrail,
    onViewerStateChange,
  ]);

  return (
    <>
      {!nothingToShow && <Menu enableSelectTool={enableSelectTool} />}
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

/**
 * Holds an array's identity steady while its contents are unchanged, so an effect
 * depending on it does not re-run for a host that rebuilds the array each render.
 */
function useStableArray(value: string[]): string[] {
  const ref = React.useRef(value);
  if (ref.current.join("\u0000") !== value.join("\u0000")) {
    ref.current = value;
  }
  return ref.current;
}

function VizarrViewerComponent({
  sources = [],
  labels = [],
  trail,
  viewState: initialViewState,
  onViewStateChange,
  onViewerStateChange,
  labelColours,
  additionalLayers,
  pluginCursor,
  onPluginClick,
  onPluginHover,
  enableSelectTool,
  children,
  logger,
}: VizarrViewerProps) {
  // Compared by value: a host rebuilding either array each render would otherwise
  // reload every source, which resets all layer state.
  const stableSources = useStableArray(sources);
  const stableLabels = useStableArray(labels);
  const stableTrail = useStableArray(trail ?? []);

  const beginLoad = useSetAtom(beginLoadAtom);
  const endLoad = useSetAtom(endLoadAtom);
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
    setLogger(logger);
    return () => setLogger(undefined);
  }, [logger]);

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
  // What is on screen, mirrored so the load effect can see it without depending on it.
  const shownSourcesRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    shownSourcesRef.current = sourceInfo.map((entry) =>
      typeof entry.config?.source === "string" ? entry.config.source : "",
    );
  }, [sourceInfo]);

  React.useEffect(() => {
    // The viewer navigates itself when a plate is drilled into, so a host syncing its
    // own state to follow would otherwise ask for a reload of what is already shown.
    if (shownSourcesRef.current.join("\u0000") === stableSources.join("\u0000")) {
      return;
    }
    if (stableSources.length === 0) {
      log.debug("No sources provided, nothing to load");
      return;
    }
    let cancelled = false;
    log.debug("Loading sources", { sources: stableSources, labels: stableLabels });
    beginLoad();
    loadSources(stableSources, stableLabels)
      .then((results) => {
        if (cancelled) {
          return;
        }
        if (!sourceDataValid(results)) {
          const error = getSourceDataError(results);
          log.error("Failed to load any source", error);
          setSourceError(writeUserErrorMessage(error));
          return;
        }
        // One source url can yield several images (a v0.6 scene), so results are flattened.
        const sourceDatas = [];
        for (const res of results) {
          if (res.status === "fulfilled") {
            sourceDatas.push(...res.value);
          } else {
            log.error("Source failed to load", res.reason);
          }
        }
        const loaded = sourceDatas.filter((s) => s !== null);
        for (const sourceData of loaded) {
          for (const warning of getSourceDataWarnings(sourceData)) {
            // Shown and logged together: a warning the user sees should always be
            // recoverable from the console too.
            log.warn(warning);
            addSourceWarning(warning);
          }
        }
        // Only for a single source: a trail describes one drill-down, and there is no
        // way to say which of several sources it belongs to.
        const withTrail =
          stableTrail.length > 0 && loaded.length === 1
            ? [{ ...loaded[0], history: stableTrail.map(decodeNavigationStep) }]
            : loaded;
        setSourceInfo(withTrail);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const error = err instanceof Error ? err : Error(String(err));
        log.error("Failed to load sources", error);
        setSourceError(writeUserErrorMessage(error));
      })
      // Runs even when the effect was cancelled, so a source list that changes mid-load
      // cannot leave the count raised and the indicator stuck on.
      .finally(() => endLoad());
    return () => {
      cancelled = true;
    };
  }, [stableSources, stableLabels, stableTrail, setSourceInfo, setSourceError, addSourceWarning, beginLoad, endLoad]);

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
      <LoadingIndicator />
      {redirectObj === null && (
        <ViewStateContext.Provider value={viewStateAtomWithEffect}>
          <ViewerBridge
            sourceUrls={stableSources}
            trail={stableTrail}
            onViewStateChange={onViewStateChange}
            onViewerStateChange={onViewerStateChange}
            additionalLayers={additionalLayers}
            pluginCursor={pluginCursor}
            onPluginClick={onPluginClick}
            onPluginHover={onPluginHover}
            enableSelectTool={enableSelectTool}
          >
            {children}
          </ViewerBridge>
        </ViewStateContext.Provider>
      )}
      {sources.length === 0 && sourceError === null && redirectObj === null && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            pointerEvents: "none",
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
              borderColor: "divider",
              pointerEvents: "auto",
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 40, color: "text.secondary" }} />
            <Typography variant="h6" fontWeight={600}>
              No image to display
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No data source was provided. Add a <code>source</code> parameter pointing at an OME-Zarr image to view it.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              endIcon={<OpenInNewIcon />}
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              component="a"
            >
              Read the documentation
            </Button>
          </Paper>
        </Box>
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
              href={`${REPOSITORY_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              component="a"
            >
              Open an issue
            </Button>
          </Paper>
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
export default function VizarrViewer({ children, theme = defaultTheme, ...props }: VizarrViewerProps) {
  const viewer = (
    <Provider>
      <VizarrViewerComponent {...props}>{children}</VizarrViewerComponent>
    </Provider>
  );
  // No provider when the host supplies the theme, so that one theme governs the whole page.
  return theme ? <ThemeProvider theme={theme}>{viewer}</ThemeProvider> : viewer;
}
