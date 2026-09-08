import type { z } from "zod";
import { bioformats2rawOMEXMLSchema, bioformats2rawOMEZattrsSchema } from "zod-ome-ngff";
import { Bf2RawSchema } from "zod-ome-ngff/0.5";

export function parseOMEXML(data: Record<string, unknown>): z.infer<typeof bioformats2rawOMEXMLSchema> | undefined {
  const result = bioformats2rawOMEXMLSchema.safeParse(data);

  if (result.success) {
    return result.data;
  }
}

export function parse(data: Record<string, unknown>): z.infer<typeof Bf2RawSchema> | undefined {
  const result = Bf2RawSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
}

export function parseOMEZattrs(
  data: Record<string, unknown>,
): z.infer<typeof bioformats2rawOMEZattrsSchema> | undefined {
  const result = bioformats2rawOMEZattrsSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
}
