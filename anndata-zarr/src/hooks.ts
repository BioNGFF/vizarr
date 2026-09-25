import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import _ from "lodash";

import { fetchDataFromZarr, getFeatureDataPath, getLabels, getObservationDataPath } from "./anndata";
import type { LabelType, labelColor } from "./components/AnndataController";
import { COLORSCALES } from "./constants/colorscales";
import { getColors } from "./utils";

interface ColourData {
  colors: labelColor[];
  min: number;
  max: number;
  categories?: string[];
  colorscale?: string[];
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

  const colours = getColors({
    data: data.data,
    max,
    min,
    colorscale,
    categories,
  });

  return {
    colors: colours,
    max,
    min,
    categories,
    colorscale,
  };
};

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
