import { useCallback } from "react";

import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import _ from "lodash";
import { z } from 'zod';


import { COLORSCALES } from "./constants/colorscales";
import { fetchDataFromZarr, getColors, getObs, getVarNames, getZarrPath } from "./utils";

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
    col: number
  }
}

export interface ColourProps {
  min: number,
  max: number,
  colorscale: string[]
}

interface AnndataQueryParams {
  url: URL,
  matrixProps?: MatrixProps,
  colorProps?: ColourProps
}

export interface AnndataURL {
  url: URL,
  namesCol: string

}



export const getAnndataColors = async (url: URL, matrixProps: MatrixProps, colorProps?: ColourProps) => {
  let zarrData;
  try {
    const zarrPath = await getZarrPath(url, matrixProps);
    zarrData = await fetchDataFromZarr(zarrPath.url, zarrPath.path, zarrPath.s);
  } catch (error) {
    console.error(error);
    return null;
  }
  if (!zarrData) return null;
  const { categories } = zarrData
  const max = categories ? categories.length - 1 : colorProps?.max || _.max(zarrData.data);
  const min = categories ? 0 : colorProps?.min || _.min(zarrData.data);
  const colorscale = categories ? COLORSCALES.Accent : colorProps?.colorscale;
  const colors = getColors({
    data: zarrData.data,
    max,
    min,
    colorProps: { ...colorProps, colorscale },
    categories,
  })
  return {
    colors: colors,
    max,
    min,
    ...(categories ? { categories } : {}),
    colorscale,
  };
};

export const useAnndataColors = (anndataQueryParams: AnndataQueryParams, opts = {}) => {
  const result = useQuery({
    queryKey: ["anndataColor", anndataQueryParams.url, anndataQueryParams.matrixProps, anndataQueryParams.colorProps],
    queryFn: () => getAnndataColors(anndataQueryParams.url, anndataQueryParams.matrixProps, anndataQueryParams.colorProps),
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

export const useAnndataFeatures = (adata: AnndataURL) => {
  const result = useQuery({
    queryKey: ["anndataFeatures", adata.url, adata.namesCol],
    queryFn: () => getVarNames(adata.url),
  });

  return result;
};

export const useAnndataObs = (adata: AnndataURL) => {
  const result = useQuery({
    queryKey: ["anndataObs", adata.url],
    queryFn: () => getObs(adata.url),
  });
  return result;
};
