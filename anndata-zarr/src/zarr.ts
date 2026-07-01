import { FetchStore, type Group, type Readable, get, open } from "zarrita";
import { z } from "zod";

const ZarrDataSchema = z.object({
  data: z.any(),
});

export async function fetchZarrGroup(url: URL): Promise<Group<Readable>> {
  const store = new FetchStore(url);
  return await open(store, { kind: "group" });
}

export async function getData(
  root: Group<Readable>,
  path: string,
  slice?: (number | null)[],
): Promise<{ data: unknown[]; dtype: string }> {
  const dataNode = await open(root.resolve(path), { kind: "array" });
  const data = await get(dataNode, slice);
  const parsedData = ZarrDataSchema.parse(data);
  try {
    const arrayData = Array.from(parsedData.data);
    return { data: arrayData, dtype: dataNode.dtype };
  } catch (error) {
    throw new Error(`Could not parse Zarr array data at  ${path}. Error: ${error}`);
  }
}
