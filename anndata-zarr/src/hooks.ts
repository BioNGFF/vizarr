import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import _ from "lodash";

import {
  fetchDataFromZarr,
  getFeatureDataPath,
  getInstanceValues,
  getLabels,
  getObservationDataPath,
  getRegionsTable,
} from "./anndata";
import type { RegionsTable } from "./anndata";
import type { LabelType, labelColor } from "./components/AnndataController";
import { COLORSCALES } from "./constants/colorscales";
import { getColors } from "./utils";

interface ColourData {
  colors: labelColor[];
  min: number;
  max: number;
  categories?: string[];
  colorscale?: string[];
  /** Something the reader should know about the colouring, short enough to show. */
  warning?: string;
}

export interface ColourProps {
  min: number;
  max: number;
  colorscale?: string[];
}

export const getAnndataColors = async (
  url: URL,
  labelQueryParameters: LabelQueryParameters | undefined,
  colorProps?: ColourProps,
): Promise<ColourData> => {
  //Basically to satisfy typescript, this function should never be called with undefined query parameters.
  if (typeof labelQueryParameters === "undefined") {
    return Promise.reject(new Error("Invalid params"));
  }

  const path =
    labelQueryParameters.type === "feature"
      ? await getFeatureDataPath(url, labelQueryParameters.labelIndex)
      : await getObservationDataPath(labelQueryParameters.labelIndex);
  const data = await fetchDataFromZarr(url, path.path, path.slice);
  let min: number;
  let max: number;
  let colorscale: string[] | undefined;
  // Categorical data is coloured by its integer code, so the domain is the category range
  // and `categories` maps each code back to its name for the legend and tooltips.
  const categories = data.categories;
  if (categories) {
    min = 0;
    max = categories.length - 1;
    colorscale = COLORSCALES.Accent;
  } else {
    max = colorProps?.max ?? _.max(data.data) ?? 0;
    min = colorProps?.min ?? _.min(data.data) ?? 0;
    colorscale = colorProps?.colorscale;
  }

  // Which label each row is about. A SpatialData regions table says so; a plain AnnData
  // table does not, and there position is all there is.
  const regions = await getRegionsTable(url);
  const labelValues = regions ? await getInstanceValues(url, regions.instanceKey) : undefined;

  const colours = getColors({
    data: data.data,
    max,
    min,
    colorscale,
    categories,
    labelValues,
  });
  return {
    colors: colours,
    max,
    min,
    categories,
    colorscale,
    warning: regionsWarning(regions),
  };
};

/**
 * What cannot be honoured about a table's own account of itself.
 *
 * One table may annotate several elements, and an instance id is only unique within its
 * region, so rows from different regions collide on a single mask. Which region to keep
 * would need the plugin to know which labels element it is colouring, which it does not.
 * Saying so beats drawing a picture that looks right.
 */
function regionsWarning(regions: RegionsTable | undefined): string | undefined {
  if (regions && Array.isArray(regions.region) && regions.region.length > 1) {
    return `This table annotates ${regions.region.length} elements at once (${regions.region.join(", ")}). Rows from all of them are being coloured together, which is unlikely to be what you want.`;
  }
  return undefined;
}

type LabelQueryParameters = {
  type: LabelType;
  labelIndex: string;
};

export type FeatureMetadata = {
  type: "feature";
  labelIndex: string;
  categories?: string[];
};

export type ObservationMetadata = {
  type: "observation";
  labelIndex: string;
  categories?: string[];
};

export function useTableLabels(url: URL): UseQueryResult<(FeatureMetadata | ObservationMetadata)[]> {
  return useQuery({
    queryKey: ["labels", url.href],
    queryFn: () => getLabels(url),
  });
}

export const useAnndataColors = (
  url: URL,
  labelQueryParameters: LabelQueryParameters | undefined,
  opts: { enabled?: boolean } = {},
): UseQueryResult<ColourData> => {
  return useQuery({
    queryKey: ["anndataColor", url.href, labelQueryParameters],
    queryFn: () => getAnndataColors(url, labelQueryParameters),
    ...opts,
  });
};
