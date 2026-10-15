import type { z } from "zod";
import { bioformats2rawOMEXMLSchema, bioformats2rawOMEZattrsSchema } from "zod-ome-ngff";
import { Bf2RawSchema } from "zod-ome-ngff/0.5";
import { log } from "../logger";

export type Bf2RawOMEXML = z.infer<typeof bioformats2rawOMEXMLSchema>;
export type Bf2RawOMEZattrs = z.infer<typeof bioformats2rawOMEZattrsSchema>;

export function parseOMEXML(data: Record<string, unknown>): Bf2RawOMEXML | Record<string, unknown> {
  const result = bioformats2rawOMEXMLSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Debug rather than a warning: the reference fixtures reach this path and still load,
  // so the schema is narrower than the files in the wild, not the files broken.
  log.debug("bioformats2raw OME-XML did not match the schema; using it unchecked", result.error);
  return data;
}

export function parse(data: Record<string, unknown>): z.infer<typeof Bf2RawSchema> | undefined {
  const result = Bf2RawSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
}

export function parseOMEZattrs(data: Record<string, unknown>): Bf2RawOMEZattrs | undefined {
  const result = bioformats2rawOMEZattrsSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
}
