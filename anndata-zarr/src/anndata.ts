import { z } from 'zod';
import type { URL } from "url";
import { FetchStore, open } from "zarrita";
import { fetchZarrGroup, getData } from './zarr';

const OBSERVATION_NAMES_PATH = 'obs'
const FEATURE_NAMES_PATH = 'var'
const CATEGORY_NAMES_PATH = 'categories'
const CATEGORY_DATA_PATH = 'codes'
const VAR_NAMES_PATH = "_index"

export interface Observation { name: string }
export interface CategoricalObservation extends Observation {
  categories: string[]
}

const ZarrAttrsSchema = z.object({
  'encoding-type': z.enum(["anndata", "dataframe", "array", "categorical", "string-array"]),
  'encoding-version': z.string()
})

const ZarrObservationAttrsSchema = ZarrAttrsSchema.extend({
  'column-order': z.array(z.string()),
  '_index': z.string().optional()
})

const AnndataCategoriesSchema = z.array(z.string())

function parseZarrObservationAttrs(attrs: unknown): z.infer<typeof ZarrObservationAttrsSchema> {
  return ZarrObservationAttrsSchema.parse(attrs)
}

function parseZarrAttrs(attrs: unknown): z.infer<typeof ZarrAttrsSchema> {
  return ZarrAttrsSchema.parse(attrs)
}

const IntegerArraySchema = z.array(z.number().int().or(z.nan()))

const FloatArraySchema = z.array(z.number().or(z.nan()))

const StringArraySchema = z.array(z.string())

const BooleanArraySchema = z.array(z.boolean())


const parseIntegerArray = function (data: unknown): z.infer<typeof IntegerArraySchema> {
  return IntegerArraySchema.parse(data)
}

function parseFloatArray(data: unknown[]): z.infer<typeof FloatArraySchema> {
  return FloatArraySchema.parse(data)
}

function parseStringArray(data: unknown[]): z.infer<typeof StringArraySchema> {
  return StringArraySchema.parse(data)
}

function parseBooleanArray(data: unknown[]): number[] {
  const parsedData = BooleanArraySchema.parse(data)
  return parsedData.map((value: boolean) => Number(value))
}

const getDataPath = function (encodingType: string): string | undefined {
  if (encodingType === 'categorical') {
    return CATEGORY_DATA_PATH
  }
  return ''
}
export const fetchDataFromZarr = async (url: URL, path: string, slice: (number | null)[] | undefined): Promise<{ data: number[], categories?: string[] }> => {
  const root = await fetchZarrGroup(url)
  const dataNodeOrGroup = await open(root.resolve(path))
  const attrs = parseZarrAttrs(dataNodeOrGroup.attrs)
  const dataPath = `${path}/${getDataPath(attrs['encoding-type'])}`
  const { data, dtype } = await getData(root, dataPath, slice)
  if (dtype === 'bool') {
    const parsedData = parseBooleanArray(data)
    return {
      data: parsedData,
      categories: ['false', 'true']
    }
  }
  if (attrs['encoding-type'] === 'categorical') {
    const parsedData = parseIntegerArray(data)
    const categoryNamesPath = `${path}/${CATEGORY_NAMES_PATH}`
    const categories = await getData(root, categoryNamesPath)
    const categoryNames = parseStringArray(categories.data)

    return {
      data: parsedData,
      categories: categoryNames
    }
  } else if (attrs['encoding-type'] === 'array') {
    const parsedData = parseFloatArray(data)
    return ({
      data: parsedData
    })
  } else if (attrs['encoding-type'] === 'string-array') {
    const parsedData = parseStringArray(data)
    return ({
      data: parsedData
    })
  }
  return ({ data: [] })

};

export const getFeatureNames = async (url: URL): Promise<string[]> => {
  try {
    const root = await fetchZarrGroup(url);

    const node = await open(root.resolve(FEATURE_NAMES_PATH))
    const parsedAttrs = ZarrObservationAttrsSchema.parse(node.attrs)
    const path = `${FEATURE_NAMES_PATH}/${parsedAttrs._index}`
    const { data, dtype } = await getData(root, path)
    return parseStringArray(data);
  } catch (error) {
    console.error(error);
    return [];
  }
};

function getObservationNamesPath(encodingType: string): string {
  if (encodingType === 'categorical') {
    return CATEGORY_NAMES_PATH
  }
  return ''
}

export const getObservationNames = async (url: URL): Promise<Array<Observation>> => {
  try {
    const root = await fetchZarrGroup(url)

    const node = (await open(root.resolve(OBSERVATION_NAMES_PATH), { kind: "group" }))
    console.log('Fetching observation names from attrs:', node.attrs)
    const attrs = parseZarrObservationAttrs(node.attrs)
    const cols = attrs["column-order"]
    const obs = await Promise.all(
      cols.map(async (col) => {
        const dataNodeOrGroup = await open(root.resolve(`${OBSERVATION_NAMES_PATH}/${col}`));
        const parsedAttrs = ZarrAttrsSchema.parse(dataNodeOrGroup.attrs)
        const dataPath = `${OBSERVATION_NAMES_PATH}/${col}/${getObservationNamesPath(parsedAttrs['encoding-type'])}`
        const dataNode = await open(root.resolve(dataPath), { kind: 'array' })
        if (dataNode.dtype === 'bool') {
          return ({ name: col, categories: ["false", "true"] })
        }
        if (parsedAttrs['encoding-type'] == 'array' || parsedAttrs['encoding-type'] === 'string-array') {
          return { name: col };
        }
        const { data, dtype } = await getData(root, dataPath)
        const parsedCategories = AnndataCategoriesSchema.parse(data)
        return { name: col, categories: parsedCategories }

      })
    )
    return obs.filter((observation) => observation != undefined)

  } catch (error) {
    console.error(error);
    return [];
  }
};

const ARRAY_PATH = 'X'

export const getVarIndex = async (url: URL, varId: string, namesCol = VAR_NAMES_PATH) => {
  const store = new FetchStore(url);
  const node = await open(store, { kind: "group" });

  const { data, dtype } = await getData(node, `${VAR_NAMES_PATH}/${namesCol}`)

  const varNames = parseStringArray(data);
  const varIndex = varNames.findIndex((name: string) => name === varId);
  debugger;
  return varIndex;
};

export async function getFeatureDataPath(url: URL, index?: number, name?: string): Promise<{ path: string, slice: (number | null)[] }> {
  if (index) {
    return ({
      path: ARRAY_PATH,
      slice: [null, index]
    })
  } else if (name) {
    return {
      path: ARRAY_PATH,
      slice: [null, await getVarIndex(url, name)]
    }
  } else {
    throw new Error(`Index or name needed to determine feature data path`)
  }
}

export async function getObservationDataPath(name: string): Promise<{ path: string, slice: undefined }> {
  return {
    path: `${OBSERVATION_NAMES_PATH}/${name}`,
    slice: undefined
  }
}

