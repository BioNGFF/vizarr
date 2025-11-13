import { ScaleBarLayer } from "@hms-dbmi/viv";
import DeckGL from "deck.gl";
import { OrthographicView } from "deck.gl";
import { useAtom, useAtomValue } from "jotai";
import * as React from "react";
import { useViewState } from "../hooks";
import { useAxisNavigation } from "../hooks/useAxisNavigation";
import { layerAtoms, viewportAtom } from "../state";
import { fitImageToViewport, getLayerSize, resolveLoaderFromLayerProps } from "../utils";

import type { DeckGLRef, OrthographicViewState, PickingInfo } from "deck.gl";
import type { GrayscaleBitmapLayerPickingInfo } from "../layers/label-layer";
import type { ViewState, VizarrLayer } from "../state";

const VIEWSTATE_EPSILON = 1e-3;
const VIEWSTATE_COMMIT_DELAY_MS = 50;

function normalizeTarget(state: OrthographicViewState | ViewState): number[] {
  const candidate = (state as OrthographicViewState).target ?? (state as ViewState).target;
  return Array.isArray(candidate) ? candidate.map((value) => Number(value)) : [];
}

function normalizeZoom(state: OrthographicViewState | ViewState): number {
  const candidate = (state as OrthographicViewState).zoom ?? (state as ViewState).zoom;
  if (Array.isArray(candidate)) {
    return candidate[0] ?? 0;
  }
  return typeof candidate === "number" ? candidate : 0;
}

function hasViewportDimensions(state: unknown): state is ViewState & { width: number; height: number } {
  if (!state || typeof state !== "object") {
    return false;
  }
  const maybe = state as { width?: unknown; height?: unknown };
  return typeof maybe.width === "number" && typeof maybe.height === "number";
}

function viewStatesEqual(a: OrthographicViewState | null, b: (OrthographicViewState | ViewState) | null): boolean {
  if (!a || !b) {
    return a === (b as OrthographicViewState | null);
  }
  const targetA = normalizeTarget(a);
  const targetB = normalizeTarget(b as OrthographicViewState | ViewState);
  const length = Math.min(targetA.length, targetB.length);
  for (let i = 0; i < length; i += 1) {
    if (Math.abs(targetA[i] - targetB[i]) > VIEWSTATE_EPSILON) {
      return false;
    }
  }
  const zoomA = normalizeZoom(a);
  const zoomB = normalizeZoom(b as OrthographicViewState | ViewState);
  return Math.abs(zoomA - zoomB) <= VIEWSTATE_EPSILON;
}

function mapDeckToViewState(next: OrthographicViewState, prev?: ViewState | null): ViewState {
  const target = normalizeTarget(next);
  const resolvedTarget = (target.length >= 2 ? [target[0], target[1]] : (prev?.target ?? [0, 0])) as [number, number];
  const zoom = normalizeZoom(next);
  const width =
    typeof (next as { width?: unknown }).width === "number" ? (next as { width: number }).width : prev?.width;
  const height =
    typeof (next as { height?: unknown }).height === "number" ? (next as { height: number }).height : prev?.height;
  return {
    zoom: Number.isFinite(zoom) ? zoom : (prev?.zoom ?? 0),
    target: resolvedTarget,
    width,
    height,
  };
}

export default function Viewer() {
  const deckRef = React.useRef<DeckGLRef>(null);
  const [viewport, setViewport] = useAtom(viewportAtom);
  const [viewState, setViewState] = useViewState();
  const [deckViewState, setDeckViewState] = React.useState<OrthographicViewState | null>(null);
  const layers = useAtomValue(layerAtoms);
  const firstLayer = layers[0] as VizarrLayer;

  useAxisNavigation(deckRef, viewport);

  const pendingViewStateRef = React.useRef<OrthographicViewState | null>(null);
  const pendingTimeoutRef = React.useRef<number | null>(null);
  const interactionStateRef = React.useRef({ isActive: false });

  const flushPendingViewState = React.useCallback(() => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    const next = pendingViewStateRef.current;
    pendingViewStateRef.current = null;
    if (next) {
      setViewState((prev) => mapDeckToViewState(next, prev));
    }
  }, [setViewState]);

  const scheduleViewStateCommit = React.useCallback(
    (next: OrthographicViewState, immediate = false) => {
      pendingViewStateRef.current = next;
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
      }
      if (immediate) {
        flushPendingViewState();
      } else {
        pendingTimeoutRef.current = window.setTimeout(flushPendingViewState, VIEWSTATE_COMMIT_DELAY_MS);
      }
    },
    [flushPendingViewState],
  );

  React.useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      pendingViewStateRef.current = null;
    };
  }, []);

  const resetViewState = React.useCallback(
    (layer: VizarrLayer) => {
      const { deck } = deckRef.current || {};
      if (deck) {
        setViewState({
          ...fitImageToViewport({
            image: getLayerSize(layer),
            viewport: deck,
            padding: deck.width < 400 ? 10 : deck.width < 600 ? 30 : 50,
            matrix: layer?.props.modelMatrix,
          }),
          width: deck.width,
          height: deck.height,
        });
      }
    },
    [setViewState],
  );

  React.useEffect(() => {
    if (!viewport && deckRef.current?.deck) {
      setViewport(deckRef.current.deck);
    }
    if (viewport && firstLayer) {
      if (!viewState) {
        resetViewState(firstLayer);
      } else if (!(viewState?.width || viewState?.height)) {
        setViewState((vs) => ({
          ...(vs as ViewState),
          width: viewport.width,
          height: viewport.height,
        }));
      }
    }
  }, [viewport, setViewport, firstLayer, resetViewState, viewState, setViewState]);

  React.useEffect(() => {
    if (!viewState) {
      setDeckViewState(null);
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      pendingViewStateRef.current = null;
      return;
    }
    if (!viewStatesEqual(pendingViewStateRef.current, viewState)) {
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      pendingViewStateRef.current = null;
    }
    setDeckViewState((prev) => (viewStatesEqual(prev, viewState) ? prev : (viewState as OrthographicViewState)));
  }, [viewState]);

  const deckLayers = React.useMemo(() => {
    if (!firstLayer || !hasViewportDimensions(viewState)) {
      return layers;
    }
    const loader = resolveLoaderFromLayerProps(firstLayer.props);
    if (Array.isArray(loader) && loader?.[0]?.meta?.physicalSizes?.x) {
      const { size, unit } = loader[0].meta.physicalSizes.x;
      const scalebar = new ScaleBarLayer({
        id: "scalebar",
        size: size / firstLayer.props.modelMatrix[0],
        unit: unit,
        viewState: viewState as unknown as OrthographicViewState,
        snap: false,
      });
      return [...layers, scalebar];
    }
    return layers;
  }, [layers, firstLayer, viewState]);

  // Enables screenshots of the canvas: https://github.com/visgl/deck.gl/issues/2200
  const glOptions: WebGLContextAttributes = {
    preserveDrawingBuffer: true,
  };

  const getTooltip = (info: GrayscaleBitmapLayerPickingInfo | PickingInfo) => {
    const pickingInfo = info as PickingInfo & {
      gridCoord?: { row: number; column: number };
      gridLabels?: { row?: string; column?: string };
    };

    if (pickingInfo.gridCoord) {
      const { row, column } = pickingInfo.gridCoord;
      if (typeof row === "number" && typeof column === "number") {
        const rowLabel = pickingInfo.gridLabels?.row;
        const columnLabel = pickingInfo.gridLabels?.column;
        const rowText = rowLabel ? `${rowLabel}` : `${row + 1}`;
        const columnText = columnLabel ? `${columnLabel}` : `${column + 1}`;
        return { text: `${rowText}${columnText}` };
      }
    }

    const { layer, index } = pickingInfo;
    const { label, value } = info as GrayscaleBitmapLayerPickingInfo;
    if (!layer || index === null || index === undefined || !label) {
      return null;
    }
    return {
      text: value !== null && value !== undefined ? `${label}: ${value}` : `${label}`,
    };
  };

  const { near, far } = React.useMemo(() => {
    if (!firstLayer) {
      return { near: 0.1, far: 1000 };
    }

    const zs = layers.flatMap((layer) => {
      const matrix = (layer as VizarrLayer)?.props?.modelMatrix;
      if (!matrix) {
        return [];
      }
      const { width, height } = getLayerSize(firstLayer);
      const corners = [
        [0, 0, 0],
        [width, 0, 0],
        [width, height, 0],
        [0, height, 0],
      ].map((corner) => matrix.transformAsPoint(corner)[2]);
      return corners;
    });

    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    return {
      near: maxZ ? -10000 * Math.abs(maxZ) : 0.1,
      far: minZ ? 10000 * Math.abs(minZ) : 1000,
    };
  }, [layers, firstLayer]);

  return (
    <DeckGL
      ref={deckRef}
      layers={deckLayers}
      viewState={(() => {
        const effective = deckViewState ?? (viewState as OrthographicViewState | null);
        return effective ? { ortho: effective } : undefined;
      })()}
      controller={{ keyboard: false }}
      onViewStateChange={(e: { viewState: OrthographicViewState; interactionState?: { inTransition?: boolean } }) => {
        setDeckViewState((prev) => (viewStatesEqual(prev, e.viewState) ? prev : e.viewState));
        const inTransition = e.interactionState?.inTransition ?? false;
        scheduleViewStateCommit(e.viewState, !inTransition);
      }}
      onInteractionStateChange={(state) => {
        const isActive = Boolean(state.isDragging || state.isZooming || state.isRotating || state.isPanning);
        if (interactionStateRef.current.isActive && !isActive) {
          flushPendingViewState();
        }
        interactionStateRef.current = { isActive };
      }}
      views={[new OrthographicView({ id: "ortho", controller: true, near, far })]}
      glOptions={glOptions}
      getTooltip={getTooltip}
      onDeviceInitialized={() => setViewport(deckRef.current?.deck || null)}
    />
  );
}
