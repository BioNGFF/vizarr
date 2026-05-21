import { useCallback } from "react";

import { useQueries, useQuery } from "@tanstack/react-query";
import _ from "lodash";

import { COLORSCALES } from "./constants/colorscales";
import { fetchDataFromZarr, getColors, getObs, getVarNames, getZarrPath } from "./utils";
import {
  getTableData,
  getFeatureNamesFromTable,
  getObsFromTable,
  getFeatureDataFromTable,
  getColumnDataFromTable,
} from "./table-loader";

// ---------------------------------------------------------------------------
// Backend-aware data fetching functions
// ---------------------------------------------------------------------------

async function getFeatureNames(url, namesCol) {
  const { meta, data } = await getTableData(url);
  if (meta.backend === "anndata") {
    return getVarNames(url, namesCol);
  }
  return getFeatureNamesFromTable(data, meta.indexKey, meta);
}

async function getObsColumns(url) {
  const { meta, data } = await getTableData(url);
  if (meta.backend === "anndata") {
    return getObs(url);
  }
  return getObsFromTable(data, meta.indexKey, meta);
}

function computeColorResult(columnData, colorProps) {
  if (!columnData) return null;
  const { categories } = columnData;
  // Convert BigInt data (from int64 zarr arrays or parquet) to Number
  let data = columnData.data;
  if (data?.length > 0 && typeof data[0] === "bigint") {
    data = Array.from(data, Number);
  }
  const max = categories ? categories.length - 1 : Number(colorProps?.max || _.max(data));
  const min = categories ? 0 : Number(colorProps?.min || _.min(data));
  const colorscale = categories ? COLORSCALES.Accent : colorProps?.colorscale;
  return {
    colors: getColors({
      data,
      max,
      min,
      colorProps: { ...colorProps, colorscale },
      categories,
    }),
    max,
    min,
    ...(categories ? { categories } : {}),
    colorscale,
  };
}

async function getColorData(url, matrixProps, colorProps) {
  const { meta, data } = await getTableData(url);

  let columnData;
  if (meta.backend === "anndata") {
    try {
      const zarrPath = await getZarrPath(url, matrixProps);
      columnData = await fetchDataFromZarr(zarrPath.url, zarrPath.path, zarrPath.s);
    } catch (error) {
      console.error(error);
      return null;
    }
  } else {
    const { feature, obs } = matrixProps || {};
    try {
      if (feature?.index !== undefined && feature?.index !== null) {
        columnData = getFeatureDataFromTable(data, feature.index, meta.indexKey, meta);
      } else if (feature?.name) {
        columnData = getColumnDataFromTable(data, feature.name);
      } else if (obs?.col) {
        columnData = getColumnDataFromTable(data, obs.col);
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  return computeColorResult(columnData, colorProps);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export const useAnndataColors = (adata = { url: null }, opts = {}) => {
  const {
    data = null,
    isLoading = false,
    serverError = null,
  } = useQuery({
    queryKey: ["tableColor", adata.url, adata.matrixProps, adata.colorProps],
    queryFn: () => getColorData(adata.url, adata.matrixProps, adata.colorProps),
    ...opts,
  });

  return { data, isLoading, serverError };
};

export const useAnndatasColors = (adatas = [], opts = {}) => {
  const combine = useCallback((results) => {
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
      queryKey: ["tableColor", url, matrixProps, colorProps],
      queryFn: () => getColorData(url, matrixProps, colorProps),
    })),
    ...opts,
    combine,
  });

  return { data, isLoading, serverError };
};

export const useAnndataFeatures = (adata = { url: null, namesCol: null }) => {
  const {
    data = null,
    isLoading = false,
    serverError = null,
  } = useQuery({
    queryKey: ["tableFeatures", adata.url, adata.namesCol],
    queryFn: () => getFeatureNames(adata.url, adata.namesCol),
  });

  return { data, isLoading, serverError };
};

export const useAnndataObs = (adata = { url: null }) => {
  const {
    data = null,
    isLoading = false,
    serverError = null,
  } = useQuery({
    queryKey: ["tableObs", adata.url],
    queryFn: () => getObsColumns(adata.url),
  });

  return { data, isLoading, serverError };
};
