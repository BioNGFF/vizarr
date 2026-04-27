import { type Atom, atom } from "jotai";
import { atomFamily, splitAtom, waitForAll } from "jotai/utils";
import { RedirectError, rethrowUnless } from "./utils";

import type { Layer } from "deck.gl";

/** Plain-data snapshot of the deck.gl canvas dimensions. */
export interface ViewportSize {
  width: number;
  height: number;
}
import type { PrimitiveAtom } from "jotai";
import type { AtomFamily } from "jotai/vanilla/utils/atomFamily";
import type { Matrix4 } from "math.gl";
import type * as zarr from "zarrita";
import type { ZarrPixelSource } from "./ZarrPixelSource";
import { initLayerStateFromSource } from "./io";

import { GridLayer, type GridLayerProps, type GridLoader } from "./layers/grid-layer";
import { LabelLayer, type LabelLayerProps, type OmeColor } from "./layers/label-layer";
import {
  ImageLayer,
  type ImageLayerProps,
  MultiscaleImageLayer,
  type MultiscaleImageLayerProps,
} from "./layers/viv-layers";

export interface ViewState {
  zoom: number;
  target: [number, number];
  width?: number;
  height?: number;
}

interface BaseConfig {
  source: string | zarr.Readable;
  axis_labels?: string[];
  name?: string;
  colormap?: string;
  opacity?: number;
  acquisition?: string;
  model_matrix?: string | number[];
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

export const sourceErrorAtom = atom<string | null>(null);
export const sourceWarningAtom = atom<string[]>([]);

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

  try {
    const sourceData = await createSourceData(config);
    const prevSourceInfo = get(sourceInfoAtom);
    if (!sourceData.name) {
      sourceData.name = `image_${Object.keys(prevSourceInfo).length}`;
    }
    set(sourceInfoAtom, [...prevSourceInfo, { id, ...sourceData }]);
  } catch (err) {
    rethrowUnless(err, Error);
    if (err instanceof RedirectError) {
      set(redirectObjAtom, { message: err.message, url: err.url });
    } else {
      set(sourceErrorAtom, err.message);
    }
  }
});

export const sourceInfoAtomAtoms = splitAtom(sourceInfoAtom);

export const layerFamilyAtom: AtomFamily<WithId<SourceData>, PrimitiveAtom<WithId<LayerState>>> = atomFamily(
  (param: WithId<SourceData>) => atom({ ...initLayerStateFromSource(param), id: param.id }),
  (a, b) => a.id === b.id,
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

export const layerAtoms = atom((get) => {
  const layerAtoms = [];
  for (const sourceAtom of get(sourceInfoAtomAtoms)) {
    const layerStateAtom = layerFamilyAtom(get(sourceAtom));
    layerAtoms.push(layerInstanceFamily(layerStateAtom));
    layerAtoms.push(imageLabelsIstanceFamily(layerStateAtom));
  }
  return get(waitForAll(layerAtoms)).flat();
});
