import { useCallback } from "react";
import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import _ from "lodash";

import { COLORSCALES } from "./constants/colorscales";
import { getColors } from "./utils";
import { fetchDataFromZarr, getObservationNames, getFeatureNames, getFeatureDataPath, getObservationDataPath, type Observation } from "./anndata";

export interface Feature {
  index?: number,
  name?: string,
  namesCol?: string
}

export interface MatrixProps {
  feature?: {
    index?: number,
    name?: string,
    namesCol?: string
  },
  obs?: {
    col?: string
  }
}

interface LabelColourMap {
  labelValue: number,
  rgba: number[]
  value: string | number
}

interface ColourData {
  colors: LabelColourMap[],
  min: number,
  max: number,
  categories?: string[],
  colorscale: string[]
}

export interface ColourProps {
  min: number,
  max: number,
  colorscale: string[]
}


export interface AnndataURL {
  url: URL,
}

export interface FeatureParams {
  type: 'feature',
  params: Feature
}
export interface ObservationParams {
  type: 'observation',
  params: Observation
}

export const getAnndataColors = async (url: URL, params: FeatureParams | ObservationParams | undefined, colorProps?: ColourProps): Promise<ColourData> => {

  if (typeof params === 'undefined') {
    return (Promise.reject(new Error('Invalid params')))
  }
  let path;

  if (params.type === 'feature') {
    path = await getFeatureDataPath(url, params.params.index)
  } else if (params.type === 'observation') {
    path = await getObservationDataPath(params.params.name)
  } else {
    throw new Error('Unknown anndata parameter type')
  }
  const data = await fetchDataFromZarr(url, path.path, path.slice);
  let min, max, colorscale, categories;
  if ('categories' in data && data.categories) {
    const categories = data.categories
    max = categories.length - 1
    min = 0
    colorscale = COLORSCALES.Accent
  } else {
    max = colorProps?.max || _.max(data.data) || 0
    min = colorProps?.min || _.min(data.data) || 0
    colorscale = colorProps?.colorscale || COLORSCALES.Accent

  }

  const colours = getColors({
    data: data.data,
    max,
    min,
    colorscale: colorscale,
    categories
  })
  return ({
    colors: colours,
    max,
    min,
    categories,
    colorscale
  })

};


export const useAnndataColors = (url: URL, param: FeatureParams | ObservationParams | undefined, opts = {}): UseQueryResult<ColourData> => {

  const result = useQuery({
    queryKey: ["anndataColor", url, param],
    queryFn: () => getAnndataColors(url, param),
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

export const useAnndataFeatures = (adata: AnndataURL): UseQueryResult<string[]> => {
  const result = useQuery({
    queryKey: ["anndataFeatures", adata.url],
    queryFn: () => getFeatureNames(adata.url),
  });
  return result;
};

export const useAnndataObs = (adata: AnndataURL) => {
  const result = useQuery({
    queryKey: ["anndataObs", adata.url],
    queryFn: () => getObservationNames(adata.url),
  });
  return result;
};
