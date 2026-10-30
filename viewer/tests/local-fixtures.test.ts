import { afterAll, beforeAll, expect, test } from "vitest";
import { createSourceData } from "../src/io";
import { startFixtureServer } from "./fixture-server";

/**
 * Reads the generated fixtures in `fixtures/local`, which `scripts/make-local-fixtures.mjs`
 * writes. Everything here runs offline, so it can sit on every pull request without
 * putting a third-party server on the critical path.
 */
let origin: string;
let stop: () => Promise<void>;

beforeAll(async () => {
  const server = await startFixtureServer();
  origin = server.url;
  stop = server.close;
});

afterAll(async () => {
  await stop();
});

test("A v0.4 image is read, with its pyramid, axes and channels", async () => {
  const [source] = await createSourceData({ source: `${origin}/image-v04.zarr` });

  expect(source.axis_labels).toEqual(["t", "c", "z", "y", "x"]);
  expect(source.loader).toHaveLength(2);
  expect(source.loader[0].shape).toEqual([1, 2, 1, 32, 32]);
  // Halving each step, which is what the scale transformations describe.
  expect(source.loader[1].shape).toEqual([1, 2, 1, 16, 16]);
  expect(source.channel_axis).toBe(1);
  expect(source.names).toEqual(["Red channel", "Green channel"]);
  expect(source.colors).toEqual(["FF0000", "00FF00"]);
});

test("A v0.5 image is read the same way, although it is a different zarr format", async () => {
  const [source] = await createSourceData({ source: `${origin}/image-v05.zarr` });

  expect(source.axis_labels).toEqual(["t", "c", "z", "y", "x"]);
  expect(source.loader).toHaveLength(2);
  expect(source.loader[0].shape).toEqual([1, 2, 1, 32, 32]);
  expect(source.names).toEqual(["Red channel", "Green channel"]);
});

test("Pixels come back, and are the gradient the fixture was written with", async () => {
  const [source] = await createSourceData({ source: `${origin}/image-v04.zarr` });
  const { data, width, height } = await source.loader[0].getRaster({ selection: [0, 0, 0] });

  expect([width, height]).toEqual([32, 32]);
  // The generator writes (x * 4 + y * 2 + c * 61) % 256, so the first row climbs by 4.
  expect(Array.from(data.slice(0, 4))).toEqual([0, 4, 8, 12]);
  // A flat plane would make the contrast limits meaningless, so check it is not flat.
  expect(Math.max(...data)).toBeGreaterThan(Math.min(...data));
});

test("A plate is read as a grid, with its empty well left empty", async () => {
  const [source] = await createSourceData({ source: `${origin}/plate-v04.zarr` });

  expect(source.rowNames).toEqual(["A", "B"]);
  expect(source.columnNames).toEqual(["1", "2"]);
  // Three of the four positions are imaged; B/2 is not, and must not become a cell.
  expect(source.loaders?.map((loader) => loader.name)).toEqual(["A1", "A2", "B1"]);
});

test("A well imaged twice offers both acquisitions, named from the plate above it", async () => {
  // Read from the well rather than the plate: only a well exposes acquisitions today.
  // The plate-level chooser arrives with the plate work, and this fixture already
  // describes what it will need.
  const [source] = await createSourceData({ source: `${origin}/plate-v04.zarr/A/1` });

  expect(source.acquisitions?.map((acquisition) => acquisition.name)).toEqual(["Second pass", "First pass"]);
});

test("A well lays out every field it holds", async () => {
  const [source] = await createSourceData({ source: `${origin}/plate-v04.zarr/A/1` });

  expect(source.loaders?.map((loader) => loader.name)).toEqual(["0", "1"]);
});

test("A missing source is reported as an error rather than an empty image", async () => {
  await expect(createSourceData({ source: `${origin}/not-here.zarr` })).rejects.toThrow();
});
