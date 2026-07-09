import { bioformats2rawOMEXMLSchema } from "zod-ome-ngff";
import type { z } from "zod";

export function parse(data: Record<string, unknown>): z.infer<typeof bioformats2rawOMEXMLSchema> | undefined {
  try {
    return bioformats2rawOMEXMLSchema.parse(data);
  } catch (error) {
    throw error;
  }
}
