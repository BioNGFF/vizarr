import { expect, test } from "vitest";
import { createSourceData } from "../src/io";

const PLATE = "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0001A/2551.zarr";

/**
 * Which image directory inside well A/1 a plate load actually opened.
 *
 * Read from the requests rather than the result, because the chosen image is the one
 * thing a loaded plate does not report: every acquisition produces the same shape.
 */
async function imagesOpenedForWellA1(acquisition?: string) {
  const seen = new Set<string>();
  const real = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const match = url.match(/2551\.zarr\/A\/1\/(\d+)\//);
    if (match) seen.add(match[1]);
    return real(input, init);
  }) as typeof fetch;
  try {
    const [data] = await createSourceData({ source: PLATE, acquisition });
    const source = data as unknown as { acquisitions?: unknown[]; acquisitionId?: number };
    return { images: [...seen].sort(), acquisitions: source.acquisitions?.length ?? 0, id: source.acquisitionId };
  } finally {
    globalThis.fetch = real;
  }
}

test("A plate offers the acquisitions its metadata lists", async () => {
  const { acquisitions, id } = await imagesOpenedForWellA1();
  expect(acquisitions).toBe(6);
  // Nothing chosen yet, which is the option the panel shows as "First acquisition".
  expect(id).toBe(-1);
}, 300000);

test("Choosing an acquisition changes which image every well draws", async () => {
  // In well A/1, image 0 is acquisition 2661, image 2 is 2653 and image 5 is 2655.
  // Without a choice the plate draws the first image, as it always has.
  expect((await imagesOpenedForWellA1()).images).toEqual(["0"]);
  expect((await imagesOpenedForWellA1("2653")).images).toEqual(["2"]);
  expect((await imagesOpenedForWellA1("2655")).images).toEqual(["5"]);
}, 900000);
