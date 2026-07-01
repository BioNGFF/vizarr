import type { URL } from "node:url";
import { FetchStore, open } from "zarrita";
import { z } from "zod";
import type { FeatureMetadata, ObservationMetadata, ObservationParams } from "./hooks";
import { fetchZarrGroup, getData } from "./zarr";

const OBSERVATION_NAMES_PATH = "obs";
const FEATURE_NAMES_PATH = "var";
const CATEGORY_NAMES_PATH = "categories";
const CATEGORY_DATA_PATH = "codes";
const VAR_NAMES_PATH = "_index";

export interface Observation {
  name: string;
}
export interface CategoricalObservation extends Observation {
  categories: string[];
}

const ZarrAttrsSchema = z.object({
  "encoding-type": z.enum(["anndata", "dataframe", "array", "categorical", "string-array"]),
  "encoding-version": z.string(),
});

const ZarrObservationAttrsSchema = ZarrAttrsSchema.extend({
  "column-order": z.array(z.string()),
  _index: z.string().optional(),
});

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

const getDataPath = (encodingType: string): string | undefined => {
  if (encodingType === "categorical") {
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
  const dataPath = `${path}/${getDataPath(attrs["encoding-type"])}`;
  const { data, dtype } = await getData(root, dataPath, slice);
  if (dtype === "bool") {
    const parsedData = parseBooleanArray(data);
    return {
      data: parsedData,
      categories: ["false", "true"],
    };
  }
  if (attrs["encoding-type"] === "categorical") {
    const parsedData = parseIntegerArray(data);
    const categoryNamesPath = `${path}/${CATEGORY_NAMES_PATH}`;
    const categories = await getData(root, categoryNamesPath);
    const categoryNames = parseStringArray(categories.data);

    return {
      data: parsedData,
      categories: categoryNames,
    };
  }
  if (attrs["encoding-type"] === "array") {
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

export const getFeatureNames = async (url: URL): Promise<FeatureMetadata[]> => {
  try {
    const root = await fetchZarrGroup(url);

    const node = await open(root.resolve(FEATURE_NAMES_PATH));
    const parsedAttrs = ZarrObservationAttrsSchema.parse(node.attrs);
    const path = `${FEATURE_NAMES_PATH}/${parsedAttrs._index}`;
    const { data, dtype } = await getData(root, path);

    const parsedData = parseStringArray(data);

    return parsedData.map((name) => {
      return {
        type: "feature",
        labelIndex: name,
      };
    });
  } catch (error) {
    console.error(error);
    return [];
  }
};

function getObservationNamesPath(encodingType: string): string {
  if (encodingType === "categorical") {
    return CATEGORY_NAMES_PATH;
  }
  return "";
}

export const getObservationNames = async (url: URL): Promise<Array<ObservationMetadata>> => {
  try {
    const root = await fetchZarrGroup(url);

    const node = await open(root.resolve(OBSERVATION_NAMES_PATH), { kind: "group" });
    console.log("Fetching observation names from attrs:", node.attrs);
    const attrs = parseZarrObservationAttrs(node.attrs);
    const cols = attrs["column-order"];
    const obs = await Promise.all(
      cols.map(async (col) => {
        const dataNodeOrGroup = await open(root.resolve(`${OBSERVATION_NAMES_PATH}/${col}`));
        const parsedAttrs = ZarrAttrsSchema.parse(dataNodeOrGroup.attrs);
        const dataPath = `${OBSERVATION_NAMES_PATH}/${col}/${getObservationNamesPath(parsedAttrs["encoding-type"])}`;
        const dataNode = await open(root.resolve(dataPath), { kind: "array" });

        const metadata: ObservationMetadata = { type: "observation", labelIndex: col };
        if (dataNode.dtype === "bool") {
          metadata.categories = ["false", "true"];
          return metadata;
        }

        if (parsedAttrs["encoding-type"] === "array") {
          return metadata;
        }

        if (parsedAttrs["encoding-type"] === "categorical") {
          const { data, dtype } = await getData(root, dataPath);
          const parsedCategories = AnndataCategoriesSchema.parse(data);
          metadata.categories = parsedCategories;
          return metadata;
        }
        return undefined;
      }),
    );
    return obs.filter((observation) => observation !== undefined);
  } catch (error) {
    console.error(error);
    return [];
  }
};

const ARRAY_PATH = "X";

export const getVarIndex = async (url: URL, varId: string, namesCol = VAR_NAMES_PATH) => {
  const store = new FetchStore(url);
  const node = await open(store, { kind: "group" });

  const { data, dtype } = await getData(node, `${VAR_NAMES_PATH}/${namesCol}`);

  const varNames = parseStringArray(data);
  const varIndex = varNames.findIndex((name: string) => name === varId);
  return varIndex;
};

export async function getFeatureDataPath(
  url: URL,
  index: string,
  name?: string,
): Promise<{ path: string; slice: (number | null)[] }> {
  if (index) {
    return {
      path: ARRAY_PATH,
      slice: [null, Number(index)],
    };
  }
  if (name) {
    return {
      path: ARRAY_PATH,
      slice: [null, await getVarIndex(url, name)],
    };
  }
  throw new Error("Index or name needed to determine feature data path");
}

export async function getObservationDataPath(name: string): Promise<{ path: string; slice: undefined }> {
  return {
    path: `${OBSERVATION_NAMES_PATH}/${name}`,
    slice: undefined,
  };
}
