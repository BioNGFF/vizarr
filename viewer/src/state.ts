import { type Atom, atom } from "jotai";
import { atomFamily, splitAtom, waitForAll } from "jotai/utils";
import { RedirectError, fitImageToViewport, getLayerSize, nameFromSource, rethrowUnless, sourceId } from "./utils";

import type { Layer } from "deck.gl";

/** Plain-data snapshot of the deck.gl canvas dimensions. */
export interface ViewportSize {
  width: number;
  height: number;
}
import type { Getter, PrimitiveAtom, Setter } from "jotai";
import type { AtomFamily } from "jotai/vanilla/utils/atomFamily";
import type { Matrix4 } from "math.gl";
import type * as zarr from "zarrita";
import type { ZarrPixelSource } from "./ZarrPixelSource";
import { applyLabelColors, initLayerStateFromSource } from "./io";

import { GridLayer, type GridLayerProps, type GridLoader } from "./layers/grid-layer";
import { LabelLayer, type LabelLayerProps, type OmeColor } from "./layers/label-layer";
import {
  ImageLayer,
  type ImageLayerProps,
  MultiscaleImageLayer,
  type MultiscaleImageLayerProps,
} from "./layers/viv-layers";

export interface ViewState {
  /**Level of zoom */
  zoom: number;
  /** Coordinates to center the view state on */
  target: [number, number];
  width?: number;
  height?: number;
}

interface BaseConfig {
  source: string | zarr.Readable;
  label?: string;
  axis_labels?: string[];
  name?: string;
  colormap?: string;
  opacity?: number;
  acquisition?: string;
  model_matrix?: string | number[];
  coordinateSystem?: string;
  onClick?: (e: unknown) => void;
}

export interface MultichannelConfig extends BaseConfig {
  colors?: string[];
  channel_axis?: number;
  contrast_limits?: [min: number, max: number][];
  names?: string[];
  visibilities?: boolean[];
}

export interface SingleChannelConfig extends BaseConfig {
  color?: string;
  contrast_limits?: [min: number, max: number];
  visibility?: boolean;
}

export type ImageLayerConfig = MultichannelConfig | SingleChannelConfig;
export type OnClickData = Record<string, unknown> & {
  gridCoord?: { row: number; column: number };
};

/**
 * One step of the trail into a plate.
 *
 * The acquisition is part of the step because the breadcrumb returns you to the view you
 * left, not to a default: coming back to a plate you were reading at one timepoint and
 * finding it at another loses your place.
 */
export type NavigationStep = { source: string; name: string; acquisition?: string };

/**
 * A trail step as a single string, so it can live in one URL parameter.
 *
 * What was being viewed rides in a fragment, because that is what a fragment is for --
 * which view of a resource -- and a zarr source never carries one of its own. The name
 * travels too: a plate is called whatever its metadata calls it, which no amount of
 * reading the url will tell you, and a refreshed page should read as the session did.
 */
export function encodeNavigationStep(step: NavigationStep): string {
  const view = new URLSearchParams();
  // Only worth carrying when it says more than the url already does.
  if (step.name && step.name !== nameFromSource(step.source)) {
    view.set("name", step.name);
  }
  if (step.acquisition) {
    view.set("acquisition", step.acquisition);
  }
  const fragment = view.toString();
  return fragment ? `${step.source}#${fragment}` : step.source;
}

/** The inverse, for a trail arriving from a URL. */
export function decodeNavigationStep(encoded: string): NavigationStep {
  const at = encoded.indexOf("#");
  const source = at === -1 ? encoded : encoded.slice(0, at);
  const view = new URLSearchParams(at === -1 ? "" : encoded.slice(at + 1));
  return {
    source,
    acquisition: view.get("acquisition") || undefined,
    // Falls back to the url for a trail written by hand.
    name: view.get("name") || nameFromSource(source),
  };
}

export type ImageLabels = Array<{
  name: string;
  loader: ZarrPixelSource[];
  modelMatrix: Matrix4;
  colors?: ReadonlyArray<OmeColor>;
}>;

export type SourceData = {
  loader: ZarrPixelSource[];
  loaders?: GridLoader[]; // for OME plates
  rows?: number;
  columns?: number;
  rowNames?: string[];
  columnNames?: string[];
  acquisitions?: Ome.Acquisition[];
  acquisitionId?: number;
  name?: string;
  /** Index of the `sources` entry this image was loaded from; see `loadSources`. */
  sourceIndex?: number;
  /** Position within that entry, where one url yielded several images. */
  subIndex?: number;
  /** What this was loaded from, so it can be reloaded with one part changed. */
  config?: ImageLayerConfig;
  channel_axis: number | null;
  colors: string[];
  names: string[];
  contrast_limits: ([min: number, max: number] | undefined)[];
  visibilities: boolean[];
  defaults: {
    selection: number[];
    colormap: string;
    opacity: number;
  };
  model_matrix: Matrix4;
  axis_labels: string[];
  onClick?: (e: OnClickData) => void;
  /**
   * The url of the image a grid cell stands for, for drilling into it.
   *
   * Set only where the host has not supplied its own click handler, since a host that
   * handles clicks decides what one means.
   */
  resolveCellSource?: (coord: { row: number; column: number }) => string | undefined;
  /** Where this was drilled into from, oldest first. Empty when opened directly. */
  history?: NavigationStep[];
  labels?: ImageLabels;
};

type LayerType = "image" | "multiscale" | "grid";
type LayerPropsMap = {
  image: ImageLayerProps;
  multiscale: MultiscaleImageLayerProps;
  grid: GridLayerProps;
};

export type LayerState<T extends LayerType = LayerType> = {
  kind: T;
  layerProps: LayerPropsMap[T];
  on: boolean;
  labels?: Array<{
    layerProps: Omit<LabelLayerProps, "selection">;
    on: boolean;
    transformSourceSelection: (sourceSelection: Array<number>) => Array<number>;
  }>;
};

type WithId<T> = T & { id: string };

export const viewStateAtom = atom<ViewState | null>(null);

/**
 * How much of the viewport's left edge the controls panel covers, in pixels.
 *
 * Reported by the panel because its width is responsive and it can be collapsed. Fitting
 * an image uses it so the image lands in the space actually visible rather than behind
 * the panel.
 */
export const panelInsetAtom = atom(0);

export const sourceErrorAtom = atom<string | null>(null);
export const sourceWarningAtom = atom<string[]>([]);

/**
 * How many source loads are in flight.
 *
 * A count rather than a flag: a host can add an image while the initial sources are
 * still arriving, and the viewer is only idle once every one of them has settled.
 *
 * This deliberately covers whole sources, not pixels. Layers that already have an image
 * on screen refine themselves by drawing a coarser resolution until a sharper one
 * arrives, which tells the user more than a spinner would.
 */
const loadingCountAtom = atom(0);

/** Whether any source is currently loading. */
export const isLoadingAtom = atom((get) => get(loadingCountAtom) > 0);

export const beginLoadAtom = atom(null, (_get, set) => {
  set(loadingCountAtom, (count) => count + 1);
});

export const endLoadAtom = atom(null, (_get, set) => {
  // Clamped so an unbalanced end can never leave the count negative and wedge the
  // viewer in a permanently "loading" state.
  set(loadingCountAtom, (count) => Math.max(0, count - 1));
});

/**
 * Which pointer interaction the toolbar has selected. "pan" is the viewer's own default;
 * "select" means a host plugin (e.g. the ROI selector) is driving region selection, so
 * the viewer only reports the mode and leaves the behaviour to that plugin.
 */
export type InteractionMode = "pan" | "select";
export const interactionModeAtom = atom<InteractionMode>("pan");

/**
 * Append a warning, ignoring one that is already displayed, so it is only shown once.
 * Uses the updater form so that concurrent writes in a single commit cannot each append
 * against a stale list.
 */
export const addSourceWarningAtom = atom(null, (_get, set, warning: string) => {
  set(sourceWarningAtom, (warnings) => (warnings.includes(warning) ? warnings : [...warnings, warning]));
});

/**
 * Derived atom that exposes the current Z-axis selection and metadata
 * from the first loaded source. Returns null when there is no source
 * or the data has no Z axis.
 */
export const currentZInfoAtom = atom((get) => {
  const sources = get(sourceInfoAtom);
  if (sources.length === 0) return null;
  const source = sources[0];
  const zAxisIndex = source.axis_labels.indexOf("z");
  if (zAxisIndex === -1) return null;
  const zMax = source.loader[0].shape[zAxisIndex] - 1;
  if (zMax <= 0) return null;
  const layerState = get(layerFamilyAtom(source));
  const zValue = layerState.layerProps.selections[0]?.[zAxisIndex] ?? 0;
  return { zValue, zMax };
});

/**
 * Derived atom that exposes the current T-axis (time) selection and metadata
 * from the first loaded source. Returns null when there is no source
 * or the data has no T axis.
 */
export const currentTInfoAtom = atom((get) => {
  const sources = get(sourceInfoAtom);
  if (sources.length === 0) return null;
  const source = sources[0];
  const tAxisIndex = source.axis_labels.indexOf("t");
  if (tAxisIndex === -1) return null;
  const tMax = source.loader[0].shape[tAxisIndex] - 1;
  if (tMax <= 0) return null;
  const layerState = get(layerFamilyAtom(source));
  const tValue = layerState.layerProps.selections[0]?.[tAxisIndex] ?? 0;
  return { tValue, tMax };
});

/**
 * Derived atom that exposes the spatial X/Y extent of the first loaded source
 * in **physical / world coordinates** (after applying the model matrix from
 * OME-Zarr coordinateTransformations).  This is the authoritative bound for
 * ROI coordinates and matches the coordinate system used by deck.gl click
 * events.
 *
 * Returns null when no source has been loaded yet, or when x/y axes cannot
 * be found in the axis labels.
 */
export const currentImageBoundsAtom = atom((get) => {
  const sources = get(sourceInfoAtom);
  if (sources.length === 0) return null;
  const source = sources[0];
  const loader = source.loader[0];
  const xAxisIndex = source.axis_labels.indexOf("x");
  const yAxisIndex = source.axis_labels.indexOf("y");
  if (xAxisIndex === -1 || yAxisIndex === -1) return null;

  const pixelW = loader.shape[xAxisIndex];
  const pixelH = loader.shape[yAxisIndex];
  const mat = source.model_matrix;

  // Transform the four pixel-space corners to world coordinates.
  const corners = [
    [0, 0, 0],
    [pixelW, 0, 0],
    [pixelW, pixelH, 0],
    [0, pixelH, 0],
  ].map((c) => mat.transformAsPoint(c));

  const unit = loader.meta?.physicalSizes?.x?.unit ?? "";

  return {
    xMin: Math.min(...corners.map((p) => p[0])),
    yMin: Math.min(...corners.map((p) => p[1])),
    xMax: Math.max(...corners.map((p) => p[0])),
    yMax: Math.max(...corners.map((p) => p[1])),
    spatialUnit: unit,
  };
});

/**
 * Write-only atom that sets the Z-axis slice for all loaded sources.
 * Pass a z index number and it will update every source's selection.
 */
export const setZSliceAtom = atom(null, (get, set, zValue: number) => {
  const sources = get(sourceInfoAtom);
  for (const source of sources) {
    const zAxisIndex = source.axis_labels.indexOf("z");
    if (zAxisIndex === -1) continue;
    const layerStateAtom = layerFamilyAtom(source);
    set(layerStateAtom, (prev) => {
      const selections = prev.layerProps.selections.map((ch) => {
        const newCh = [...ch];
        newCh[zAxisIndex] = zValue;
        return newCh;
      });
      return { ...prev, layerProps: { ...prev.layerProps, selections } };
    });
  }
});

/**
 * Write-only atom that sets the T-axis (time) slice for all loaded sources.
 * Pass a t index number and it will update every source's selection.
 */
export const setTSliceAtom = atom(null, (get, set, tValue: number) => {
  const sources = get(sourceInfoAtom);
  for (const source of sources) {
    const tAxisIndex = source.axis_labels.indexOf("t");
    if (tAxisIndex === -1) continue;
    const layerStateAtom = layerFamilyAtom(source);
    set(layerStateAtom, (prev) => {
      const selections = prev.layerProps.selections.map((ch) => {
        const newCh = [...ch];
        newCh[tAxisIndex] = tValue;
        return newCh;
      });
      return { ...prev, layerProps: { ...prev.layerProps, selections } };
    });
  }
});

export interface Redirect {
  url: string;
  message: string;
}
export const redirectObjAtom = atom<Redirect | null>(null);

export const viewportAtom = atom<ViewportSize | null>(null);

export const sourceInfoAtom = atom<WithId<SourceData>[]>([]);

export const addImageAtom = atom(null, async (get, set, config: ImageLayerConfig) => {
  const { createSourceData } = await import("./io");
  const id = Math.random().toString(36).slice(2);

  set(beginLoadAtom);
  try {
    const sourceData = await createSourceData(config);
    const prevSourceInfo = get(sourceInfoAtom);
    if (!sourceData[0].name) {
      sourceData[0].name = `image_${Object.keys(prevSourceInfo).length}`;
    }
    set(sourceInfoAtom, [...prevSourceInfo, { id, ...sourceData[0] }]);
  } catch (err) {
    rethrowUnless(err, Error);
    if (err instanceof RedirectError) {
      set(redirectObjAtom, { message: err.message, url: err.url });
    } else {
      set(sourceErrorAtom, err.message);
    }
  } finally {
    set(endLoadAtom);
  }
});

/**
 * Reload one source showing a different acquisition, replacing it where it sits.
 *
 * Changing acquisition changes which arrays are read, so this is a load rather than a
 * layer toggle. Only the one source is replaced, leaving any others alone, and the new
 * id means the layer state describes the acquisition actually on screen. Returning to a
 * previous acquisition returns to its settings, since the family keeps both.
 *
 * `acquisitionId` below zero means "no particular acquisition", matching the option the
 * panel offers.
 */
export const setAcquisitionAtom = atom(null, async (get, set, params: { id: string; acquisitionId: number }) => {
  const sources = get(sourceInfoAtom);
  const entry = sources.find((source) => source.id === params.id);
  const config = entry?.config;
  // Nothing to reload from for a source added through the programmatic API without a
  // url, so the panel leaves it as it is rather than guessing.
  if (!entry || !config || typeof config.source !== "string") {
    return;
  }
  const acquisition = params.acquisitionId < 0 ? undefined : String(params.acquisitionId);
  const nextConfig = { ...config, acquisition };
  const { createSourceData } = await import("./io");
  set(beginLoadAtom);
  try {
    const [data] = await createSourceData(nextConfig);
    // A change of acquisition is the same image at another timepoint, so it keeps the
    // name it was already shown under.
    if (!data.name) {
      data.name = entry.name;
    }
    const nextId = sourceId(config.source, entry.sourceIndex ?? 0, entry.subIndex ?? 0, {
      label: config.label,
      acquisition,
    });
    const replacement = {
      ...data,
      id: nextId,
      sourceIndex: entry.sourceIndex,
      subIndex: entry.subIndex,
      config: nextConfig,
      // Changing the acquisition is a change of view, not a move, so the way back out
      // of the plate is still the way back out.
      history: entry.history,
    };
    // The id may be one shown before, whose layers deck.gl has already finalized.
    dropLayerInstances(replacement);
    set(
      sourceInfoAtom,
      get(sourceInfoAtom).map((source) => (source.id === params.id ? replacement : source)),
    );
  } catch (err) {
    rethrowUnless(err, Error);
    set(sourceErrorAtom, err.message);
  } finally {
    set(endLoadAtom);
  }
});

/**
 * Replace one source with another, keeping a trail of where it came from.
 *
 * This is how drilling into a plate works: the well takes the plate's place in the same
 * viewer rather than opening a second one, so the view, the plugins and every other
 * source stay as they are. `history` is what lets the panel offer the way back.
 *
 * `trimTo` rewinds instead: it drops back to that depth in the trail, which is what the
 * breadcrumb's earlier steps do.
 */
async function replaceSource(
  get: Getter,
  set: Setter,
  params: { id: string; source: string; history: NavigationStep[]; acquisition?: string; name?: string },
): Promise<void> {
  const current = get(sourceInfoAtom);
  const entry = current.find((source) => source.id === params.id);
  if (!entry?.config) {
    return;
  }
  // An acquisition does not follow a move inwards -- a well shows all of its images --
  // but stepping back out restores the one that step was recorded with.
  const nextConfig: ImageLayerConfig = { ...entry.config, source: params.source, acquisition: params.acquisition };
  const { createSourceData } = await import("./io");
  set(beginLoadAtom);
  try {
    const [data] = await createSourceData(nextConfig);
    // Only `loadSources` names an unnamed image, and a move does not go through it. A
    // field of a well rarely names itself, so the caller's name for it stands in rather
    // than leaving the panel header blank.
    if (!data.name && params.name) {
      data.name = params.name;
    }
    const nextId = sourceId(params.source, entry.sourceIndex ?? 0, entry.subIndex ?? 0, {
      label: nextConfig.label,
      acquisition: nextConfig.acquisition,
    });
    const replacement = {
      ...data,
      id: nextId,
      sourceIndex: entry.sourceIndex,
      subIndex: entry.subIndex,
      config: nextConfig,
      history: params.history,
    };
    // The id may be one shown before, whose layers deck.gl has already finalized.
    dropLayerInstances(replacement);
    set(
      sourceInfoAtom,
      get(sourceInfoAtom).map((source) => (source.id === params.id ? replacement : source)),
    );
  } catch (err) {
    rethrowUnless(err, Error);
    set(sourceErrorAtom, err.message);
  } finally {
    set(endLoadAtom);
  }
}

/** Drill into `source`, remembering the image being left behind. */
export const navigateIntoAtom = atom(null, async (get, set, params: { id: string; source: string; name?: string }) => {
  const entry = get(sourceInfoAtom).find((source) => source.id === params.id);
  const from = entry?.config?.source;
  if (!entry || typeof from !== "string") {
    return;
  }
  const history = [
    ...(entry.history ?? []),
    { source: from, name: entry.name ?? "Image", acquisition: entry.config?.acquisition },
  ];
  await replaceSource(get, set, { id: params.id, source: params.source, history, name: params.name });
});

/** Go back to `depth` steps into the trail, which the breadcrumb's earlier steps do. */
export const navigateBackAtom = atom(null, async (get, set, params: { id: string; depth: number }) => {
  const entry = get(sourceInfoAtom).find((source) => source.id === params.id);
  const trail = entry?.history ?? [];
  const step = trail[params.depth];
  if (!step) {
    return;
  }
  await replaceSource(get, set, {
    id: params.id,
    source: step.source,
    history: trail.slice(0, params.depth),
    acquisition: step.acquisition,
    name: step.name,
  });
});

export const sourceInfoAtomAtoms = splitAtom(sourceInfoAtom);

export const layerFamilyAtom: AtomFamily<WithId<SourceData>, PrimitiveAtom<WithId<LayerState>>> = atomFamily(
  (param: WithId<SourceData>) => atom({ ...initLayerStateFromSource(param), id: param.id }),
  (a, b) => a.id === b.id,
);

/**
 * View state that frames the first loaded image in the current viewport, or null when
 * there is nothing loaded or the viewport size is not known yet.
 *
 * Exposed as a value rather than applied directly so that the caller writes it through
 * ViewStateContext; writing viewStateAtom here would skip the host's onViewStateChange.
 */
export const firstLayerFitAtom = atom((get) => {
  const sources = get(sourceInfoAtom);
  const viewport = get(viewportAtom);
  if (sources.length === 0 || !viewport) {
    return null;
  }
  const layerProps = get(layerFamilyAtom(sources[0])).layerProps;
  return {
    ...fitImageToViewport({
      insetLeft: get(panelInsetAtom),
      image: getLayerSize({ props: layerProps } as VizarrLayer),
      viewport,
      // Matches LayerFitToViewportButton, so per-layer and global fit agree.
      padding: viewport.width < 400 ? 10 : viewport.width < 600 ? 30 : 50,
      matrix: layerProps.modelMatrix,
    }),
    width: viewport.width,
    height: viewport.height,
  };
});

/**
 * Apply externally-supplied label colours (e.g. from a table plugin) to the already
 * loaded sources, indexed in parallel with the `sources` prop.
 *
 * Colours are written into the existing layer state rather than into the source data so
 * that recolouring does not require re-fetching the image, which would also discard any
 * layer settings the user has changed.
 */
export const setLabelColorsAtom = atom(
  null,
  (get, set, labelColors: ReadonlyArray<ReadonlyArray<OmeColor>> | undefined) => {
    if (!labelColors) {
      return;
    }
    for (const [index, source] of get(sourceInfoAtom).entries()) {
      // A v0.6 scene expands one source url into several images, so position in sourceInfo
      // is not the position in `sources`; fall back to it only for sources loaded elsewhere.
      const colors = labelColors[source.sourceIndex ?? index];
      if (!colors?.length) {
        continue;
      }
      const layerStateAtom = layerFamilyAtom(source);
      const layerState = get(layerStateAtom);
      if (layerState.labels?.[0]?.layerProps.colors === colors) {
        continue;
      }
      const next = applyLabelColors(layerState, colors);
      if (!next) {
        // The image itself is fine, so this is a warning rather than a load error.
        set(addSourceWarningAtom, `Label colours were provided for "${source.name}", which has no label image.`);
        continue;
      }
      set(layerStateAtom, next);
    }
  },
);

export type VizarrLayer =
  | Layer<MultiscaleImageLayerProps>
  | Layer<ImageLayerProps>
  | Layer<GridLayerProps>
  | Layer<LabelLayerProps>;

const LayerConstructors = {
  image: ImageLayer,
  multiscale: MultiscaleImageLayer,
  grid: GridLayer,
} as const;

const layerInstanceFamily = atomFamily((a: Atom<LayerState>) =>
  atom((get) => {
    const { on, layerProps, kind } = get(a);
    if (!on) {
      return null;
    }
    const Layer = LayerConstructors[kind];
    // @ts-expect-error - TS can't resolve that Layer & layerProps bound together
    return new Layer({ ...layerProps, pickable: layerProps.pickable ?? false }) as VizarrLayer;
  }),
);

const imageLabelsIstanceFamily = atomFamily((a: Atom<LayerState>) =>
  atom((get) => {
    const { on, labels, layerProps } = get(a);
    if (!on || !labels) {
      return [];
    }
    return labels.map((label) =>
      label.on
        ? new LabelLayer({
            ...label.layerProps,
            selection: label.transformSourceSelection(layerProps.selections[0]),
            pickable: true,
          })
        : null,
    );
  }),
);

/**
 * Drop the memoized deck.gl layers for a source id.
 *
 * `layerInstanceFamily` rebuilds only when its layer state changes, so returning to a
 * source shown earlier -- switching an acquisition back, or stepping up a plate -- finds
 * an unchanged state and hands deck.gl the very layer instance it has already finalized.
 * Nothing then draws until a viewport change forces an update. The layer *state* is kept,
 * so whatever was tuned for that image is still there; only the instance is rebuilt.
 */
function dropLayerInstances(source: WithId<SourceData>): void {
  const layerStateAtom = layerFamilyAtom(source);
  layerInstanceFamily.remove(layerStateAtom);
  imageLabelsIstanceFamily.remove(layerStateAtom);
}

export const layerAtoms = atom((get) => {
  const layerAtoms = [];
  for (const sourceAtom of get(sourceInfoAtomAtoms)) {
    const layerStateAtom = layerFamilyAtom(get(sourceAtom));
    layerAtoms.push(layerInstanceFamily(layerStateAtom));
    layerAtoms.push(imageLabelsIstanceFamily(layerStateAtom));
  }
  return get(waitForAll(layerAtoms)).flat();
});
