import { describe, expect, test } from "vitest";
import { coordinateSystemsFromTransformations, outputName, selectCoordinateSystem } from "../src/coordinate-systems";

/**
 * Choosing the space an image is drawn in.
 *
 * Pure, and worth being pure: getting this wrong does not throw, it puts an image
 * somewhere else on the canvas, which is the hardest kind of mistake to notice and the
 * easiest kind to write down.
 */

const AXES = [
  { name: "y", type: "space" },
  { name: "x", type: "space" },
] as Ome.Axis[];

describe("outputName", () => {
  test("reads the string form, which NGFF 0.6 writes", () => {
    expect(outputName({ output: "global" })).toBe("global");
  });

  test("reads the object form, which the transformations proposal writes", () => {
    expect(outputName({ output: { name: "global", axes: AXES } })).toBe("global");
  });

  test.each([
    ["no output at all", {}],
    ["an output that is neither", { output: 7 }],
    ["an object without a name", { output: { axes: AXES } }],
  ])("returns undefined for %s", (_, transformation) => {
    expect(outputName(transformation)).toBeUndefined();
  });
});

describe("coordinateSystemsFromTransformations", () => {
  test("names every system the transformations map into, in the order met", () => {
    const systems = coordinateSystemsFromTransformations(
      [{ output: { name: "element" } }, { output: { name: "global" } }],
      AXES,
    );
    expect(systems?.map((system) => system.name)).toEqual(["element", "global"]);
  });

  test("names a system once however many transformations reach it", () => {
    const systems = coordinateSystemsFromTransformations(
      [{ output: { name: "global" } }, { output: { name: "global" } }],
      AXES,
    );
    expect(systems?.map((system) => system.name)).toEqual(["global"]);
  });

  test.each([
    ["there are no transformations", undefined],
    ["the transformations name nothing", [{ type: "scale" } as { output?: unknown }]],
  ])("returns undefined when %s", (_, transformations) => {
    // Undefined rather than an empty list, so a caller falls back to what it did before
    // instead of being handed something it has to test for.
    expect(coordinateSystemsFromTransformations(transformations, AXES)).toBeUndefined();
  });
});

describe("selectCoordinateSystem", () => {
  const systems = [
    { name: "element", axes: AXES },
    { name: "global", axes: AXES },
  ];

  test("takes the first when nothing was asked for and nothing preferred", () => {
    // An image that lists its own systems keeps the one it has always been drawn in,
    // even where one of them happens to be called `global`.
    expect(selectCoordinateSystem(systems)?.name).toBe("element");
  });

  test("takes the preferred one where the image has it", () => {
    expect(selectCoordinateSystem(systems, undefined, "global")?.name).toBe("global");
  });

  test("falls back to the first where the preferred one is absent", () => {
    expect(selectCoordinateSystem([{ name: "only", axes: AXES }], undefined, "global")?.name).toBe("only");
  });

  test("returns what was asked for", () => {
    expect(selectCoordinateSystem(systems, "element")?.name).toBe("element");
  });

  test("returns nothing for a name the image does not have", () => {
    // Rather than quietly substituting another, which would draw the image in a
    // different space than the one asked for and say nothing about it.
    expect(selectCoordinateSystem(systems, "somewhere-else")).toBeUndefined();
  });
});
