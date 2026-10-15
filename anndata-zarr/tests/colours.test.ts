import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import yaml from "yaml";
import { getFeatureDataPath, getObservationNames, getVarIndex } from "../src/anndata";
import { getAnndataColors } from "../src/hooks";
import expectedColours from "./expected_colours.json";

const fixtures_path = path.resolve(path.join(__dirname, "..", "..", "fixtures"));

const table = yaml.parse(fs.readFileSync(path.join(fixtures_path, "anndata_table.yaml"), "utf-8"));
const url = new URL(table.source);

test("Can get anndata colours", async () => {
  const colours = await getAnndataColors(url, { type: "feature", labelIndex: "3" });

  expect(colours).toEqual(expectedColours);
});

test("Feature names are resolved against var's index, not coerced to a position", async () => {
  // Coercing the name to a number used to yield a NaN slice, which zarrita accepts
  // silently and returns an all-zero column for.
  expect(await getVarIndex(url, "3")).toBe(3);
  expect(await getFeatureDataPath(url, "3")).toEqual({ path: "X", slice: [null, 3] });
});

test("An unknown feature name is an error rather than a blank column", async () => {
  await expect(getAnndataColors(url, { type: "feature", labelIndex: "CD3E" })).rejects.toThrow(/not found/);
});

test("Categorical observations are coloured by category name", async () => {
  const colours = await getAnndataColors(url, { type: "observation", labelIndex: "categorical" });

  expect(colours.categories).toEqual(["cat0", "cat1", "cat2"]);
  expect(colours.min).toBe(0);
  expect(colours.max).toBe(2);
  // `value` is what the viewer shows on hover, so it must be the name, not the code.
  expect(new Set(colours.colors.map((c) => c.value))).toEqual(new Set(["cat0", "cat1", "cat2"]));
});

test("Boolean observations are coloured as a two-category column", async () => {
  const colours = await getAnndataColors(url, { type: "observation", labelIndex: "boolean" });

  expect(colours.categories).toEqual(["false", "true"]);
  expect(new Set(colours.colors.map((c) => c.value))).toEqual(new Set(["false", "true"]));
});

test("Numerical observations are coloured over their own data range", async () => {
  const colours = await getAnndataColors(url, { type: "observation", labelIndex: "float" });

  expect(colours.categories).toBeUndefined();
  expect(colours.min).toBeLessThan(colours.max);
  expect(colours.colors.every((c) => typeof c.value === "number")).toBe(true);
});

test("Observation metadata reports categories only for categorical columns", async () => {
  const observations = await getObservationNames(url);
  const byName = new Map(observations.map((o) => [o.labelIndex, o]));

  expect(byName.get("categorical")?.categories).toEqual(["cat0", "cat1", "cat2"]);
  expect(byName.get("boolean")?.categories).toEqual(["false", "true"]);
  expect(byName.get("float")?.categories).toBeUndefined();
});
