import { type UseQueryResult, useQueries, useQuery } from "@tanstack/react-query";
import _ from "lodash";
import { useCallback } from "react";

import type { argv0 } from "node:process";
import {
  fetchDataFromZarr,
  getFeatureDataPath,
  getFeatureNames,
  getLabels,
  getObservationDataPath,
  getObservationNames,
} from "./anndata";
import type { LabelType, labelColor } from "./components/AnndataController";
import { COLORSCALES } from "./constants/colorscales";
import { getColors } from "./utils";

export interface Feature {
  index: string;
  name?: string;
  namesCol?: string;
}

export interface MatrixProps {
  feature?: {
    index?: number;
    name?: string;
    namesCol?: string;
  };
  obs?: {
    col?: string;
  };
}

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

export interface AnndataURL {
  url: URL;
}

export interface FeatureParams {
  type: "feature";
  index: number;
}
export interface ObservationParams {
  type: "observation";
  index: string;
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

  if (labelQueryParameters.type !== "feature" && labelQueryParameters.type !== "observation") {
    throw new Error("Unknown table parameter type: ", labelQueryParameters.type);
  }

  let path: { path: string; slice: undefined | (number | null)[] };

  if (labelQueryParameters.type === "feature") {
    path = await getFeatureDataPath(url, labelQueryParameters.labelIndex);
  } else {
    path = await getObservationDataPath(labelQueryParameters.labelIndex);
  }
  const data = await fetchDataFromZarr(url, path.path, path.slice);
  let min = 0;
  let max = 0;

  let colorscale: string[] | undefined;
  let categories: string[] | undefined;
  if ("categories" in data && data.categories) {
    const categories = data.categories;
    max = categories.length - 1;
    min = 0;
    colorscale = COLORSCALES.Accent;
  } else {
    max = colorProps?.max || _.max(data.data) || 0;
    min = colorProps?.min || _.min(data.data) || 0;
    colorscale = colorProps?.colorscale;
  }
  const colours = getColors({
    data: data.data,
    max,
    min,
    colorscale: colorscale,
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
  const labels = useQuery({
    queryKey: ["labels", url],
    queryFn: () => getLabels(url),
  });

  return labels;
}

export const useAnndataColors = (
  url: URL,
  labelQueryParameters: LabelQueryParameters | undefined,
  opts = {},
): UseQueryResult<ColourData> => {
  const result = useQuery({
    queryKey: ["anndataColor", url, labelQueryParameters],
    queryFn: () => getAnndataColors(url, labelQueryParameters),
    ...opts,
  });
  return result;
};

export const useAnndatasColors = (adatas = [], opts = {}) => {
  const combine = useCallback((results: UseQueryResult[]) => {
    return {
      data: results.map((result) => result.data),
      isLoading: results.some((result) => result.isLoading),
      serverError: results.find((result) => result.error),
    };
  }, []);

  const {
    data = null,
    isLoading = false,
    serverError = null,
  } = useQueries({
    queries: adatas.map(({ url, matrixProps, colorProps }) => ({
      queryKey: ["anndataColor", url, matrixProps, colorProps],
      queryFn: () => getAnndataColors(url, matrixProps, colorProps),
    })),
    ...opts,
    combine,
  });

  return { data, isLoading, serverError };
};

export const useAnndataFeatures = (adata: AnndataURL): UseQueryResult<FeatureMetadata[]> => {
  const result = useQuery({
    queryKey: ["anndataFeatures", adata.url],
    queryFn: () => getFeatureNames(adata.url),
  });
  return result;
};

export const useAnndataObs = (adata: AnndataURL): UseQueryResult<ObservationMetadata[]> => {
  const result = useQuery({
    queryKey: ["anndataObs", adata.url],
    queryFn: () => getObservationNames(adata.url),
  });
  return result;
};
