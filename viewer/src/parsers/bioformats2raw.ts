import { bioformats2rawOMEXMLSchema, bioformats2rawOMEZattrsSchema } from "zod-ome-ngff";
import { Bf2RawSchema } from "zod-ome-ngff/0.5";
import type { z } from "zod";

export function parseOMEXML(data: Record<string, unknown>): z.infer<typeof bioformats2rawOMEXMLSchema> | undefined {
  try {
    return bioformats2rawOMEXMLSchema.parse(data);
  } catch (error) {
    throw error;
  }
}

export function parse(data: Record<string, unknown>): z.infer<typeof Bf2RawSchema> {
  try {
    return Bf2RawSchema.parse(data);
  } catch (error) {
    throw error;
  }
}

export function parseOMEZattrs(data: Record<string, unknown>): z.infer<typeof bioformats2rawOMEZattrsSchema> {
  try {
    console.log(data);
    return bioformats2rawOMEZattrsSchema.parse(data);
  } catch (error) {
    throw error;
  }
}
