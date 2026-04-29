/**
 * Table loader for non-anndata backends (CSV, JSON, Parquet).
 * Detects backend type from .zattrs and normalizes data into
 * a column-oriented format compatible with the anndata-zarr hooks.
 */

// Promise-based caches to deduplicate concurrent requests
const _metaPromises = new Map();
const _tablePromises = new Map();

/**
 * Detect table backend and metadata from .zattrs.
 * Result is cached per URL.
 */
export function getTableMeta(url) {
  if (!_metaPromises.has(url)) {
    _metaPromises.set(url, _fetchTableMeta(url));
  }
  return _metaPromises.get(url);
}

async function _fetchTableMeta(url) {
  const res = await fetch(`${url}/.zattrs`);
  if (!res.ok) throw new Error(`Failed to load table metadata from ${url}`);
  const attrs = await res.json();
  const backend = attrs.backend || (attrs["encoding-type"] === "anndata" ? "anndata" : "unknown");
  if (backend === "unknown") {
    console.warn(`[anndata-zarr] Unrecognized table backend at ${url}. Expected one of: anndata, csv, json, parquet.`);
  } else {
    console.log(`[anndata-zarr] Detected table backend: ${backend} (${url})`);
  }
  return {
    backend,
    indexKey: attrs.index_key || attrs.instance_key || null,
    categoricalColumns: attrs.categorical_columns || [],
    measurementColumns: attrs.measurement_columns || [],
    metadataColumns: attrs.metadata_columns || [],
  };
}

/**
 * Load and cache table metadata + data.
 * For anndata backend, returns { meta, data: null }.
 * For flat backends, returns { meta, data: { col: values[] } }.
 */
export function getTableData(url) {
  if (!_tablePromises.has(url)) {
    _tablePromises.set(url, _fetchTableData(url));
  }
  return _tablePromises.get(url);
}

async function _fetchTableData(url) {
  let meta;
  try {
    meta = await getTableMeta(url);
  } catch (error) {
    console.error(`[anndata-zarr] Failed to load table metadata from ${url}:`, error);
    throw error;
  }
  if (meta.backend === "anndata") {
    return { meta, data: null };
  }
  try {
    const data = await _loadFlatTable(url, meta.backend);
    return { meta, data };
  } catch (error) {
    console.error(`[anndata-zarr] Failed to load ${meta.backend} table from ${url}:`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function _parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function _parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return {};

  const headers = _parseCsvLine(lines[0]);
  const columns = {};
  for (const h of headers) columns[h] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = _parseCsvLine(lines[i]);
    for (let j = 0; j < headers.length; j++) {
      columns[headers[j]].push(values[j]);
    }
  }

  // Auto-detect and convert numeric columns
  for (const key of Object.keys(columns)) {
    const col = columns[key];
    if (col.length > 0 && col.every((v) => v !== "" && !Number.isNaN(Number(v)))) {
      columns[key] = col.map(Number);
    }
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Backend-specific loaders
// ---------------------------------------------------------------------------

async function _loadFlatTable(url, backend) {
  switch (backend) {
    case "csv": {
      const res = await fetch(`${url}/table.csv`);
      if (!res.ok) throw new Error(`Failed to load CSV from ${url}/table.csv`);
      return _parseCsv(await res.text());
    }
    case "json": {
      const res = await fetch(`${url}/table/.zattrs`);
      if (!res.ok) throw new Error(`Failed to load JSON from ${url}/table/.zattrs`);
      return await res.json();
    }
    case "parquet": {
      const { parquetMetadata, parquetRead } = await import("hyparquet");
      const res = await fetch(`${url}/table.parquet`);
      if (!res.ok) throw new Error(`Failed to load parquet from ${url}/table.parquet`);
      const buffer = await res.arrayBuffer();

      const metadata = parquetMetadata(buffer);
      const columnNames = metadata.schema.slice(1).map((s) => s.name);
      const columns = {};
      for (const name of columnNames) columns[name] = [];

      await parquetRead({
        file: buffer,
        metadata,
        onComplete: (rows) => {
          for (const row of rows) {
            for (let i = 0; i < columnNames.length; i++) {
              columns[columnNames[i]].push(row[i]);
            }
          }
        },
      });

      return columns;
    }
    default:
      console.error(`[anndata-zarr] Unsupported table backend: "${backend}". Supported: csv, json, parquet.`);
      throw new Error(`Unsupported table backend: ${backend}`);
  }
}

// ---------------------------------------------------------------------------
// Data extraction from flat (column-oriented) tables
// ---------------------------------------------------------------------------

/**
 * Get feature (numeric column) names from flat table data.
 * Uses measurement_columns from metadata if available, otherwise infers
 * from column data types.
 */
export function getFeatureNamesFromTable(tableData, indexKey, meta = {}) {
  if (meta.measurementColumns?.length > 0) {
    return meta.measurementColumns.filter((key) => key in tableData);
  }
  return Object.keys(tableData).filter((key) => {
    if (key === indexKey) return false;
    const col = tableData[key];
    return col.length > 0 && typeof col[0] === "number";
  });
}

/**
 * Get observation metadata columns from flat table data.
 * Returns { categorical: [{name, categories}], numerical: [] } matching
 * the shape returned by getObs() for anndata.
 */
export function getObsFromTable(tableData, indexKey, meta = {}) {
  const obs = { categorical: [], numerical: [] };
  for (const [key, values] of Object.entries(tableData)) {
    if (key === indexKey) continue;
    const isCategorical =
      meta.categoricalColumns?.length > 0
        ? meta.categoricalColumns.includes(key)
        : values.length > 0 && typeof values[0] === "string";
    if (isCategorical) {
      const categories = [...new Set(values)].map(String);
      obs.categorical.push({ name: key, categories });
    }
  }
  return obs;
}

/**
 * Get a single column's data, applying categorical encoding for string columns.
 * Returns { data: number[] } or { data: number[], categories: string[] }.
 */
export function getColumnDataFromTable(tableData, colName) {
  const values = tableData[colName];
  if (!values) throw new Error(`Column "${colName}" not found in table`);

  if (values.length > 0 && typeof values[0] === "string") {
    const categories = [...new Set(values)];
    const categoryMap = new Map(categories.map((c, i) => [c, i]));
    return { data: values.map((v) => categoryMap.get(v)), categories };
  }
  return { data: values };
}

/**
 * Get feature data by matrix index from a flat table.
 */
export function getFeatureDataFromTable(tableData, featureIndex, indexKey, meta = {}) {
  const featureNames = getFeatureNamesFromTable(tableData, indexKey, meta);
  if (featureIndex < 0 || featureIndex >= featureNames.length) {
    throw new Error(`Feature index ${featureIndex} out of range (0-${featureNames.length - 1})`);
  }
  return { data: tableData[featureNames[featureIndex]] };
}
