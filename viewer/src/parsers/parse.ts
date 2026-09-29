import type { Attributes } from "zarrita";
import type { z } from "zod";
import * as omeNgffSchemas from "zod-ome-ngff";
import { log } from "../logger";
import { MetadataError } from "../services/http";

const imageTypes = ["ImageSchema", "WellSchema", "PlateSchema"] as const;
const versions = ["v01", "v02", "v03", "v04", "v05", "v06"] as const;

interface Schema {
  type: (typeof imageTypes)[number] | "SceneSchema";
  version: (typeof versions)[number];
  schema: z.ZodType<unknown, z.ZodTypeDef, unknown>;
}

const schemas: Schema[] = imageTypes.flatMap((type: (typeof imageTypes)[number]) => {
  return versions.flatMap((version: (typeof versions)[number]) => {
    return {
      type: type,
      version: version,
      schema: omeNgffSchemas[version][type],
    };
  });
});

schemas.push({ type: "SceneSchema", version: "v06", schema: omeNgffSchemas.v06.SceneSchema });

export function parse(data: Attributes) {
  const validParsers = schemas.filter((schema) => {
    return schema.schema.safeParse(data).success;
  });

  // Indexing the last match directly used to throw an internal TypeError when nothing
  // matched, which reached the user as "Cannot read properties of undefined".
  const parser = validParsers.at(-1);
  if (!parser) {
    throw new MetadataError(
      "The metadata at this source does not match any supported OME-NGFF version.",
      "No OME-NGFF schema matched the group attributes.",
    );
  }
  log.debug("Parsed OME-NGFF metadata", { type: parser.type, version: parser.version });
  return {
    data: parser.schema.parse(data),
    version: parser.version,
    type: parser.type,
  };
}
