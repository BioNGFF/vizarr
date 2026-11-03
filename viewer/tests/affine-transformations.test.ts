import { describe, expect, test } from "vitest";
import { coordinateTransformationsToMatrix } from "../src/coordinate-transformations";

/**
 * Building a 4x4 from a transformation declared over an element's own axes.
 *
 * The awkward part is that an element need not have all three spatial axes, and that an
 * affine carries a translation in one more column than it has rows while a rotation does
 * not. Both get this wrong quietly: the result is a matrix, and a wrong matrix draws
 * something, somewhere.
 */

const YX = [
  { name: "y", type: "space" },
  { name: "x", type: "space" },
] as Ome.Axis[];

const ZYX = [
  { name: "z", type: "space" },
  { name: "y", type: "space" },
  { name: "x", type: "space" },
] as Ome.Axis[];

describe("an affine over a 2D element", () => {
  // A quarter turn with a scale, as a rasterized SpatialData label carries. Rows are the
  // element's axes in its own order -- y then x -- and the last column is the shift.
  const affine = {
    type: "affine" as const,
    affine: [
      [0, -2, 100],
      [2, 0, 5],
    ],
  };

  test("leaves the axis the element does not have alone", () => {
    // Not zero. Zeroing z makes the matrix singular, which collapses the layer and
    // cannot be inverted -- and inverting it is how the label layer places its tiles.
    const matrix = coordinateTransformationsToMatrix([affine], YX);
    expect(matrix.getScale()[2]).toBe(1);
  });

  test("applies the translation, which used to be dropped entirely", () => {
    const matrix = coordinateTransformationsToMatrix([affine], YX);
    // Column-major, so [12] and [13] are the x and y shifts. The element's rows are y
    // then x, so x takes the 5 and y the 100.
    expect([matrix[12], matrix[13]]).toEqual([5, 100]);
  });

  test("puts the linear part in x, y order whatever order the element declares", () => {
    const matrix = coordinateTransformationsToMatrix([affine], YX);
    // x' = 2y, y' = -2x, written column-major.
    expect([matrix[0], matrix[4]]).toEqual([0, 2]);
    expect([matrix[1], matrix[5]]).toEqual([-2, 0]);
  });

  test("moves a point the way the affine says", () => {
    const matrix = coordinateTransformationsToMatrix([affine], YX);
    // The affine reads (y, x) -> (y', x'): y' = -2x + 100, x' = 2y + 5. For y=1, x=3
    // that is y' = 94, x' = 7.
    expect(matrix.transformAsPoint([3, 1, 0], [])).toEqual([7, 94, 0]);
  });
});

describe("a rotation, which is square and carries no translation", () => {
  const rotation = {
    type: "rotation" as const,
    rotation: [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
  };

  test("is read as a rotation rather than having a column taken for a shift", () => {
    const matrix = coordinateTransformationsToMatrix([rotation], ZYX);
    expect([matrix[12], matrix[13], matrix[14]]).toEqual([0, 0, 0]);
    expect(matrix.getScale().map(Math.round)).toEqual([1, 1, 1]);
  });
});
