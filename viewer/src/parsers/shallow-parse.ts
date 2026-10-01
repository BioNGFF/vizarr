/**
 *@module
 *Utility schemas and functions to detect image version and type before deeper parsing
 */

import { z } from "zod";
import type { ImageTypes, Versions } from "./parse";

const hasOmeSchema = z.object({
  ome: z.object({}).passthrough(),
});

const hasOmeroSchema = z.object({
  omero: z.object({}).passthrough(),
});

const hasVersionSchema = z.object({
  version: z.union([
    z.literal("0.1"),
    z.literal("0.2"),
    z.literal("0.3"),
    z.literal("0.4"),
    z.literal("0.5"),
    z.literal("0.6"),
    z.literal("0.6.dev3"),
  ]),
});

const isImageSchema = z.object({
  multiscales: z.array(z.object({}).passthrough()),
});

const isWellSchema = z.object({
  well: z.object({}).passthrough(),
});

const isPlateSchema = z.object({
  plate: z.object({}).passthrough(),
});

const isLabelSchema = z.object({
  "image-label": z.object({}).passthrough(),
});

const isLabelsSchema = z.object({
  labels: z.array(z.any()),
});

const isBf2RawSchema = z.object({
  "bioformats2raw.layout": z.number(),
});

const isScene = z.object({
  scene: z.object({}).passthrough(),
});

const typeSchemas = [
  { type: "label", schema: isLabelSchema },
  { type: "labels", schema: isLabelsSchema },
  { type: "image", schema: isImageSchema },
  { type: "well", schema: isWellSchema },
  { type: "plate", schema: isPlateSchema },
  { type: "bf2Raw", schema: isBf2RawSchema },
  { type: "scene", schema: isScene },
] as const;

export function narrowVersionAndType(data: object): { version: Versions | undefined; type: ImageTypes | undefined } {
  let version: Versions | undefined;
  let type: ImageTypes | undefined;
  let parsedData: object = data;
  const hasOme = hasOmeSchema.safeParse(data);
  if (hasOme.success) {
    parsedData = hasOme.data.ome;
    const hasVersion = hasVersionSchema.safeParse(hasOme.data.ome);
    if (hasVersion.success) {
      version = hasVersion.data.version;
      type = typeSchemas.find((schema) => {
        const result = schema.schema.safeParse(parsedData);
        return result.success;
      })?.type;

      return { version: version, type: type };
    }
  }

  type = typeSchemas.find((schema) => {
    const result = schema.schema.safeParse(parsedData);
    return result.success;
  })?.type;

  const hasOmero = hasOmeroSchema.safeParse(parsedData);
  if (hasOmero.success) {
    const hasVersion = hasVersionSchema.safeParse(hasOmero.data.omero);
    if (hasVersion.success) {
      return { version: hasVersion.data.version, type: type };
    }
  }

  if (type === "image") {
    const multiscales = isImageSchema.parse(parsedData).multiscales;
    const hasVersion = hasVersionSchema.safeParse(multiscales[0]);
    if (hasVersion.success) {
      return { version: hasVersion.data.version, type: type };
    }
  }
  return { version: version, type: type };
}
