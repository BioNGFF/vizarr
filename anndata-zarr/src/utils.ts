import _ from "lodash";
import { FetchStore, get, open, Group, type Readable, type DataType, Array as ZarrArray, type Float64 } from "zarrita";

import { COLORSCALES } from "./constants/colorscales";
import type { ColourProps, MatrixProps } from "./hooks";
import type { URL } from "url";
import { z } from 'zod';

const AnndataZarrBaseAttributesSchema = z.object({
  'encoding-type': z.enum(["anndata", "dataframe", "array", "categorical", "string-array"]),
  'encoding-version': z.string()
})

const AnndataZarrObsAttributesSchema = AnndataZarrBaseAttributesSchema.extend({
  'column-order': z.array(z.string()),
  '_index': z.string().optional()
})

const AnndataCategoriesSchema = z.array(z.string())



function resolveAnndataZarrObsAttributes(attrs: unknown): z.infer<typeof AnndataZarrObsAttributesSchema> {
  return AnndataZarrObsAttributesSchema.parse(attrs)
}

function resolveAnndataZarrBaseAttributes(attrs: unknown): z.infer<typeof AnndataZarrBaseAttributesSchema> {
  return AnndataZarrBaseAttributesSchema.parse(attrs)
}


async function fetchZarrGroup(url: URL): Promise<Group<Readable>> {
  const store = new FetchStore(url)
  return await open(store, { kind: "group" })
}

async function fetchZarrArray(url: URL, path: string): Promise<ZarrArray<DataType>> {
  const store = new FetchStore(url)
  return await open(store, { kind: "array" })
}


const RawColourData = z.object({
  data: z.any(),
  shape: z.array(z.number()),
  stride: z.array(z.number())
})

const RawCategoricalColourData = z.object({
  data: z.array(z.number()),
  categories: z.array(z.string())
})

const parseRawColourData = function (data: unknown): z.infer<typeof RawColourData> {
  return RawColourData.parse(data)
}

const parseRawCategoricalColourData = function (data: unknown): z.infer<typeof RawCategoricalColourData> {
  return RawCategoricalColourData.parse(data)
}

export const fetchDataFromZarr = async (url: URL, path: string, s: []): Promise<{ data: number[], categories?: string[] }> => {
  try {
    const node = await fetchZarrGroup(url)
    const dataNode = await open(node.resolve(path))
    const attrs = resolveAnndataZarrBaseAttributes(dataNode.attrs)

    if (dataNode instanceof Group) {
      if (attrs["encoding-type"] === "categorical") {
        const categoriesArr = await open(dataNode.resolve("categories"), {
          kind: "array",
        });
        const codesArr = await open(dataNode.resolve("codes"), { kind: "array" });
        const categories = await get(categoriesArr);
        const parsedCategories = parseRawColourData(categories)
        const data = await get(codesArr, s);
        const parsedData = parseRawColourData(data)
        return { data: parsedData.data, categories: parsedCategories.data }
      }
    } else if (dataNode instanceof ZarrArray) {
      if (attrs["encoding-type"] === "array" && dataNode.dtype === "bool") {
        const boolData = await get(dataNode, s);
        const parsedBoolData = parseRawColourData(boolData)
        return {
          data: Array.from(parsedBoolData.data),
          categories: ["false", "true"],
        };
      } else if (attrs["encoding-type"] === "array" || attrs["encoding-type"] === "string-array") {
        return parseRawColourData(await get(dataNode, s));
      }
    }

    return ({ data: [] })

  } catch (error) {
    // biome-ignore lint/complexity/noUselessCatch: @TODO: better error handling
    throw error;
  }
};

export const getVarNames = async (url: URL) => {
  try {
    const store = new FetchStore(url);
    const node = await open(store, { kind: "group" });
    const varNode = await open(node.resolve('var'))
    const parsedAttrs = AnndataZarrObsAttributesSchema.parse(varNode.attrs)
    //To-do try default "_index"
    const array = await open(node.resolve(`var/${parsedAttrs._index}`), { kind: "array" });
    const varNames = (await get(array)).data;
    return varNames;

  } catch (error) {
    console.error(error);
    return [];
  }
};

type Observation = { name: string, categories?: string[] }

export const getObs = async (url: URL): Promise<Array<Observation>> => {
  try {
    const store = new FetchStore(url);
    const node = await open(store, { kind: "group" });

    const obsNode = (await open(node.resolve("obs"), { kind: "group" }))
    const attrs = resolveAnndataZarrObsAttributes(obsNode.attrs)
    const cols = attrs["column-order"]

    const obs = await Promise.all(
      cols.map(async (col) => {
        const dataNode = await open(node.resolve(`obs/${col}`));
        const encodingType = dataNode.attrs['encoding-type'] || {};

        if (dataNode instanceof ZarrArray) {
          if (dataNode.dtype === 'bool') {
            return ({ name: col, categories: ["false", "true"] })
          }
          if (encodingType == 'array' || encodingType === 'string-array') {
            return { name: col };
          }

        } else if (dataNode instanceof Group) {
          const categoriesArr = await open(dataNode.resolve("categories"), {
            kind: "array",
          });
          const categories = await get(categoriesArr);
          const parsedCategories = AnndataCategoriesSchema.parse(categories.data)
          return { name: col, categories: parsedCategories }
        }

      })
    )

    return obs.filter((observation) => observation != undefined)

  } catch (error) {
    console.error(error);
    return [];
  }
};

export const getVarIndex = async (url: URL, varId: string, namesCol = "_index") => {
  try {
    const store = new FetchStore(url);
    const node = await open(store, { kind: "group" });

    const arr = await open(node.resolve(`var/${namesCol}`), { kind: "array" });
    const varNames = (await get(arr)).data;
    const varIndex = varNames.findIndex((name) => name === varId);
    return varIndex;
  } catch (error) {
    return -1;
  }
};

export const getZarrPath = async (url: URL, matrixProps: MatrixProps) => {
  const { feature, obs } = matrixProps;
  if (feature) {
    if (feature.index !== undefined && feature.index !== null) {
      return { url, path: "X", s: [null, feature.index] };
    }
    if (feature.name) {
      return {
        url,
        path: "X",
        s: [null, await getVarIndex(url, feature.name, feature.namesCol)],
      };
    }
  }

  if (obs) {
    return {
      url,
      path: `obs/${obs.col}`,
      s: null,
    };
  }

  throw new Error("No feature or obs in matrixProps");
};

const parseHexColor = (color: string) => {
  const r = Number.parseInt(color?.substring(1, 3), 16);
  const g = Number.parseInt(color?.substring(3, 5), 16);
  const b = Number.parseInt(color?.substring(5, 7), 16);

  return [r, g, b];
};

const interpolateColor = (color1: string, color2: string, factor: number) => {
  const [r1, g1, b1] = parseHexColor(color1);
  const [r2, g2, b2] = parseHexColor(color2);

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return [r, g, b];
};

const computeColor = (colormap: string[], value: number) => {
  if (!colormap || Number.isNaN(value)) {
    return [0, 0, 0, 255];
  }
  if (value <= 0) {
    return parseHexColor(colormap[0]);
  }
  if (value >= 1) {
    return parseHexColor(colormap[colormap.length - 1]);
  }
  const index1 = Math.floor(value * (colormap.length - 1));
  const index2 = Math.ceil(value * (colormap.length - 1));
  const factor = (value * (colormap.length - 1)) % 1;
  return interpolateColor(colormap[index1], colormap[index2], factor);
};

export const getColor = ({ value, colorscale = COLORSCALES.Viridis }: { value: number, colorscale: string[] }) => {
  return [...computeColor(colorscale, value), 255];
};

export const getColors = ({ data, max, min, colorProps, categories }: { data: number[], max: number, min: number, colorProps: ColourProps, categories?: string[] }) => {
  return _.map(data, (v: number, i: number) => ({
    labelValue: i + 1,
    rgba: getColor({ value: (v - min) / (max - min), ...colorProps }),
    value: categories ? (categories[v] ?? v) : v,
  }));
};
