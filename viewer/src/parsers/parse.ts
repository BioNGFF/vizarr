import type { Attributes } from "zarrita";
import type { z } from "zod";
import { v01, v02, v03, v04, v05, v06 } from "zod-ome-ngff";

const omeNgffSchemas = { v01: v01, v02: v02, v03: v03, v04: v04, v05: v05, v06: v06 };
interface Schema {
  type: string;
  version: string;
  schema: z.ZodType<unknown, z.ZodTypeDef, unknown>;
}

const schemas: Schema[] = Object.keys(omeNgffSchemas).flatMap((version) => {
  const imageTypes = Object.keys(omeNgffSchemas[version as keyof typeof omeNgffSchemas]);
  return imageTypes.flatMap((imageType) => {
    return {
      type: imageType,
      version: version,
      schema: omeNgffSchemas[version][imageType],
    };
  });
});

schemas.push({ type: "SceneSchema", version: "v06", schema: omeNgffSchemas.v06.SceneSchema });

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
