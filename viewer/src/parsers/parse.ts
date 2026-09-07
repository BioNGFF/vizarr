import type { Attributes } from "zarrita";
import type { z } from "zod";
import { v01, v02, v03, v04, v05, v06 } from "zod-ome-ngff";

interface Schema {
  type: string;
  version: string;
  schema: z.ZodType<unknown, z.ZodTypeDef, unknown>;
}

const schemas: Schema[] = [
  { version: "v01", type: "ImageSchema", schema: v01.ImageSchema },
  { version: "v01", type: "PlateSchema", schema: v01.PlateSchema },
  { version: "v01", type: "WellSchema", schema: v01.WellSchema },

  { version: "v02", type: "ImageSchema", schema: v02.ImageSchema },
  { version: "v02", type: "PlateSchema", schema: v02.PlateSchema },
  { version: "v02", type: "WellSchema", schema: v02.WellSchema },

  { version: "v03", type: "ImageSchema", schema: v03.ImageSchema },
  { version: "v03", type: "PlateSchema", schema: v03.PlateSchema },
  { version: "v03", type: "WellSchema", schema: v03.WellSchema },

  { version: "v04", type: "ImageSchema", schema: v04.ImageSchema },
  { version: "v04", type: "PlateSchema", schema: v04.PlateSchema },
  { version: "v04", type: "WellSchema", schema: v04.WellSchema },
  { version: "v04", type: "Bf2RawSchema", schema: v04.Bf2RawSchema },
  { version: "v04", type: "LabelSchema", schema: v04.LabelSchema },

  { version: "v05", type: "ImageSchema", schema: v05.ImageSchema },
  { version: "v05", type: "WellSchema", schema: v05.WellSchema },
  { version: "v05", type: "PlateSchema", schema: v05.PlateSchema },
  { version: "v05", type: "Bf2RawSchema", schema: v05.Bf2RawSchema },
  { version: "v05", type: "LabelSchema", schema: v05.LabelSchema },

  { version: "v06", type: "ImageSchema", schema: v06.ImageSchema },
  { version: "v06", type: "WellSchema", schema: v06.WellSchema },
  { version: "v06", type: "PlateSchema", schema: v06.PlateSchema },
  { version: "v06", type: "Bf2RawSchema", schema: v06.Bf2RawSchema },
  { version: "v06", type: "LabelSchema", schema: v06.LabelSchema },
  { version: "v06", type: "SceneSchema", schema: v06.SceneSchema },
];

//TO-DO Raise more user-friendly error messages - use zod-validation-error?
// Raise warning instead of error - stil attempt to read and display the image even if it fails validation
//
// TO-DO Try to more intelligently infer the schema type and version.
// Then only attempt parsing against this version and type.
export function parse(data: Attributes) {
  const validParsers = schemas.filter((schema) => {
    if (!schema) return false;
    const parsedData = schema.schema.safeParse(data);
    return parsedData.success;
  });

  const parser = validParsers[validParsers.length - 1];
  if (parser) {
    return {
      data: parser.schema.parse(data),
      version: parser.version,
      type: parser.type,
    };
  }
  return {
    data: data,
    version: "unknown",
    type: "unknown",
  };
}
