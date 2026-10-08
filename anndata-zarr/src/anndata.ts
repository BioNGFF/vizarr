import { type Group, type Readable, open } from "zarrita";
import { z } from "zod";
import type { FeatureMetadata, ObservationMetadata } from "./hooks";
import { log } from "./logger";
import { fetchZarrGroup, getData } from "./zarr";

const OBSERVATION_NAMES_PATH = "obs";
const FEATURE_NAMES_PATH = "var";
const CATEGORY_NAMES_PATH = "categories";
const CATEGORY_DATA_PATH = "codes";
const DEFAULT_INDEX_NAME = "_index";

const EncodingTypeSchema = z.enum(["anndata", "dataframe", "array", "categorical", "string-array"]);
type EncodingType = z.infer<typeof EncodingTypeSchema>;

/**
 * AnnData records the encoding on every group it writes, but arrays produced by other
 * tools can arrive without it. The fields are optional rather than absent from the schema,
 * so a value that *is* present still has to be one we understand.
 */
const ZarrAttrsSchema = z.object({
  "encoding-type": EncodingTypeSchema.optional(),
  "encoding-version": z.string().optional(),
});

const ZarrObservationAttrsSchema = ZarrAttrsSchema.extend({
  "column-order": z.array(z.string()),
  _index: z.string().optional(),
});

/** What an array without a declared encoding is treated as. */
const DEFAULT_ENCODING_TYPE: EncodingType = "array";

function encodingType(attrs: z.infer<typeof ZarrAttrsSchema>): EncodingType {
  return attrs["encoding-type"] ?? DEFAULT_ENCODING_TYPE;
}

const AnndataCategoriesSchema = z.array(z.string());

function parseZarrObservationAttrs(attrs: unknown): z.infer<typeof ZarrObservationAttrsSchema> {
  return ZarrObservationAttrsSchema.parse(attrs);
}

function parseZarrAttrs(attrs: unknown): z.infer<typeof ZarrAttrsSchema> {
  return ZarrAttrsSchema.parse(attrs);
}

const IntegerArraySchema = z.array(z.number().int().or(z.nan()));

const FloatArraySchema = z.array(z.number().or(z.nan()));

const StringArraySchema = z.array(z.string());

const BooleanArraySchema = z.array(z.boolean());

const parseIntegerArray = (data: unknown): z.infer<typeof IntegerArraySchema> => IntegerArraySchema.parse(data);

function parseFloatArray(data: unknown[]): z.infer<typeof FloatArraySchema> {
  return FloatArraySchema.parse(data);
}

function parseStringArray(data: unknown[]): z.infer<typeof StringArraySchema> {
  return StringArraySchema.parse(data);
}

function parseBooleanArray(data: unknown[]): number[] {
  const parsedData = BooleanArraySchema.parse(data);
  return parsedData.map((value: boolean) => Number(value));
}

const getDataPath = (encoding: EncodingType): string | undefined => {
  if (encoding === "categorical") {
    return CATEGORY_DATA_PATH;
  }
  return "";
};
export const fetchDataFromZarr = async (
  url: URL,
  path: string,
  slice: (number | null)[] | undefined,
): Promise<{ data: number[]; categories?: string[] }> => {
  const root = await fetchZarrGroup(url);

  const dataNodeOrGroup = await open(root.resolve(path));

  const attrs = parseZarrAttrs(dataNodeOrGroup.attrs);
  const encoding = encodingType(attrs);

  const dataPath = `${path}/${getDataPath(encoding)}`;

  const { data, dtype } = await getData(root, dataPath, slice);
  if (dtype === "bool") {
    const parsedData = parseBooleanArray(data);
    return {
      data: parsedData,
      categories: ["false", "true"],
    };
  }
  if (encoding === "categorical") {
    const parsedData = parseIntegerArray(data);
    const categoryNamesPath = `${path}/${CATEGORY_NAMES_PATH}`;
    const categories = await getData(root, categoryNamesPath);
    const categoryNames = parseStringArray(categories.data);

    return {
      data: parsedData,
      categories: categoryNames,
    };
  }
  if (encoding === "array") {
    const parsedData = parseFloatArray(data);
    return {
      data: parsedData,
    };
  }
  return { data: [] };
};

export async function getLabels(url: URL): Promise<(FeatureMetadata | ObservationMetadata)[]> {
  const featureNames = await getFeatureNames(url);
  const observationNames = await getObservationNames(url);
  return [...featureNames, ...observationNames];
}

/**
 * Read `var`'s index column, which holds the feature (row) names of the `X` matrix.
 * The column name comes from `var`'s `_index` attribute, falling back to the AnnData default.
 */
async function getVarNames(root: Group<Readable>, namesCol?: string): Promise<string[]> {
  const node = await open(root.resolve(FEATURE_NAMES_PATH));
  const parsedAttrs = parseZarrObservationAttrs(node.attrs);
  const path = `${FEATURE_NAMES_PATH}/${namesCol ?? parsedAttrs._index ?? DEFAULT_INDEX_NAME}`;
  const { data } = await getData(root, path);
  return parseStringArray(data);
}

export const getFeatureNames = async (url: URL): Promise<FeatureMetadata[]> => {
  try {
    const root = await fetchZarrGroup(url);
    const varNames = await getVarNames(root);

    return varNames.map((name) => {
      return {
        type: "feature",
        labelIndex: name,
      };
    });
  } catch (error) {
    log.error("Could not read feature names; none will be offered", error);
    return [];
  }
};

function getObservationNamesPath(encoding: EncodingType): string {
  if (encoding === "categorical") {
    return CATEGORY_NAMES_PATH;
  }
  return "";
}

export const getObservationNames = async (url: URL): Promise<Array<ObservationMetadata>> => {
  try {
    const root = await fetchZarrGroup(url);

    const node = await open(root.resolve(OBSERVATION_NAMES_PATH), { kind: "group" });
    const attrs = parseZarrObservationAttrs(node.attrs);
    const cols = attrs["column-order"];
    const obs = await Promise.all(
      cols.map(async (col) => {
        const dataNodeOrGroup = await open(root.resolve(`${OBSERVATION_NAMES_PATH}/${col}`));
        const parsedAttrs = parseZarrAttrs(dataNodeOrGroup.attrs);
        const colEncoding = encodingType(parsedAttrs);
        const dataPath = `${OBSERVATION_NAMES_PATH}/${col}/${getObservationNamesPath(colEncoding)}`;
        const dataNode = await open(root.resolve(dataPath), { kind: "array" });

        const metadata: ObservationMetadata = { type: "observation", labelIndex: col };
        if (dataNode.dtype === "bool") {
          metadata.categories = ["false", "true"];
          return metadata;
        }

        if (colEncoding === "array") {
          return metadata;
        }

        if (colEncoding === "categorical") {
          const { data } = await getData(root, dataPath);
          const parsedCategories = AnndataCategoriesSchema.parse(data);
          metadata.categories = parsedCategories;
          return metadata;
        }
        return undefined;
      }),
    );
    return obs.filter((observation) => observation !== undefined);
  } catch (error) {
    log.error("Could not read observation names; none will be offered", error);
    return [];
  }
};

const ARRAY_PATH = "X";

export const getVarIndex = async (url: URL, varId: string, namesCol?: string): Promise<number> => {
  const root = await fetchZarrGroup(url);
  const varNames = await getVarNames(root, namesCol);
  return varNames.findIndex((name: string) => name === varId);
};

/**
 * Resolve a feature name to a column slice of the `X` matrix.
 *
 * `name` is the feature's entry in `var`'s index, not its position: numeric
 * coercion would silently produce a `NaN` slice for any dataset whose features
 * are named (e.g. gene symbols), which zarrita accepts without erroring.
 */
export async function getFeatureDataPath(
  url: URL,
  name: string,
  namesCol?: string,
): Promise<{ path: string; slice: (number | null)[] }> {
  if (!name) {
    throw new Error("A feature name is needed to determine the feature data path");
  }
  const index = await getVarIndex(url, name, namesCol);
  if (index < 0) {
    throw new Error(`Feature "${name}" not found in "${FEATURE_NAMES_PATH}"`);
  }
  return {
    path: ARRAY_PATH,
    slice: [null, index],
  };
}

export async function getObservationDataPath(name: string): Promise<{ path: string; slice: undefined }> {
  return {
    path: `${OBSERVATION_NAMES_PATH}/${name}`,
    slice: undefined,
  };
}
