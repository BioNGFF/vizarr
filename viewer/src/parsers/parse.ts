import { z } from "zod";

import { v01, v02, v03, v04, v05, v06 } from "zod-ome-ngff";
import {
  transformImagev01,
  transformImagev02,
  transformImagev03,
  transformImagev04,
  transformImagev05,
  transformImagev06,
} from "./transformers/ImageTransformers";
import { narrowVersionAndType } from "./shallow-parse";

export type Versions = "0.1" | "0.2" | "0.3" | "0.4" | "0.5" | "0.6" | "0.6" | "0.6.dev3";
export type ImageTypes = "image" | "well" | "plate" | "labels" | "label" | "scene" | "bf2Raw";

const LabelsSchemav04 = z.object({
  labels: z.array(z.string()),
});

const LabelsSchemav05 = z.object({
  ome: z.object({
    labels: z.array(z.string()),
  }),
});

function schemaEntry<V extends string, K extends string, S extends z.ZodSchema, R>(
  version: V,
  type: K,
  schema: S,
  transformer: (input: z.infer<S>) => R,
) {
  return { version, type, schema, transformer };
}

const schemaList = [
  schemaEntry("0.1", "image", v01.ImageSchema, transformImagev01),
  schemaEntry("0.1", "plate", v01.PlateSchema, transformImagev01),
  schemaEntry("0.1", "well", v01.WellSchema, transformImagev01),

  schemaEntry("0.2", "image", v02.ImageSchema, transformImagev02),
  schemaEntry("0.2", "plate", v02.PlateSchema, transformImagev02),
  schemaEntry("0.2", "well", v02.WellSchema, transformImagev02),

  schemaEntry("0.3", "image", v03.ImageSchema, transformImagev03),
  schemaEntry("0.3", "plate", v03.PlateSchema, transformImagev03),
  schemaEntry("0.3", "well", v03.WellSchema, transformImagev03),

  schemaEntry("0.4", "image", v04.ImageSchema, transformImagev04),
  schemaEntry("0.4", "plate", v04.PlateSchema, transformImagev04),
  schemaEntry("0.4", "well", v04.WellSchema, transformImagev04),
  schemaEntry("0.4", "bf2Raw", v04.Bf2RawSchema, transformImagev04),
  schemaEntry("0.4", "label", v04.LabelSchema, transformImagev04),
  schemaEntry("0.4", "labels", LabelsSchemav04, transformImagev04),

  schemaEntry("0.5", "image", v05.ImageSchema, transformImagev05),
  schemaEntry("0.5", "well", v05.WellSchema, transformImagev05),
  schemaEntry("0.5", "plate", v05.PlateSchema, transformImagev05),
  schemaEntry("0.5", "bf2Raw", v05.Bf2RawSchema, transformImagev05),
  schemaEntry("0.5", "label", v05.LabelSchema, transformImagev05),
  schemaEntry("0.5", "labels", LabelsSchemav05, transformImagev05),

  schemaEntry("0.6", "image", v06.ImageSchema, transformImagev06),
  schemaEntry("0.6", "well", v06.WellSchema, transformImagev06),
  schemaEntry("0.6", "plate", v06.PlateSchema, transformImagev06),
  schemaEntry("0.6", "bf2Raw", v06.Bf2RawSchema, transformImagev06),
  schemaEntry("0.6", "label", v06.LabelSchema, transformImagev06),
  schemaEntry("0.6", "labels", LabelsSchemav05, transformImagev06),
  schemaEntry("0.6", "scene", v06.SceneSchema, transformImagev06),
  //Temporary for test data based on 0.6.dev3 version
  schemaEntry("0.6.dev3", "image", v06.ImageSchema, transformImagev06),
  schemaEntry("0.6.dev3", "well", v06.WellSchema, transformImagev06),
  schemaEntry("0.6.dev3", "plate", v06.PlateSchema, transformImagev06),
  schemaEntry("0.6.dev3", "bf2Raw", v06.Bf2RawSchema, transformImagev06),
  schemaEntry("0.6.dev3", "label", v06.LabelSchema, transformImagev06),
  schemaEntry("0.6.dev3", "labels", LabelsSchemav05, transformImagev06),
  schemaEntry("0.6.dev3", "scene", v06.SceneSchema, transformImagev06),
] as const;

type SchemaEntry = (typeof schemaList)[number];

function findEntry<V extends SchemaEntry["version"], K extends SchemaEntry["type"]>(version: V, type: K) {
  return schemaList.find(
    (e): e is Extract<SchemaEntry, { version: V; type: K }> => e.version === version && e.type === type,
  );
}
type ParseResult<E extends SchemaEntry = SchemaEntry> = E extends unknown
  ? {
    version: E["version"];
    type: E["type"];
    data: ReturnType<E["transformer"]>;
    success: true;
  }
  : never;

//TO-DO Raise more user-friendly error messages - use zod-validation-error?
// Raise warning instead of error - stil attempt to read and display the image even if it fails validation
export function parse(data: object, schemas = schemaList): ParseResult | undefined {
  const versionAndType = narrowVersionAndType(data);
  if (versionAndType.version && versionAndType.type) {
    const schema = findEntry(versionAndType.version, versionAndType.type);
    if (schema) {
      const result = schema.schema.safeParse(data);
      if (result.success) {
        const data = result.data;
        const transformer = schema.transformer;

        const transform = schema.transformer as (input: typeof data) => ReturnType<typeof transformer>;

        const returnVal = {
          data: transform(result.data),
          version: schema.version,
          type: schema.type,
          success: true,
        } as ParseResult<typeof schema>;
        return returnVal;
      }
      console.log(result.error);
    }
  }

  const parsedResult = tryBruteForceParse(data, schemas);
  if (parsedResult.success) {
    return parsedResult as ParseResult;
  }
}
function tryBruteForceParse(data: object, schemas = schemaList) {
  const validSchema = schemas.find((entry: SchemaEntry) => {
    return entry.schema.safeParse(data).success;
  });

  if (validSchema) {
    const result = validSchema.schema.parse(data);
    const transform = validSchema.transformer as (input: typeof result) => unknown;
    return {
      data: transform(result),
      version: validSchema.version,
      type: validSchema.type,
      success: true,
    };
  }
  return { success: false };
}
