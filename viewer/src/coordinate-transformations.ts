import type * as viv from "@vivjs/types";
import { Matrix4 } from "math.gl";
import { log } from "./logger";

/**
 * Convert an array of coordinateTransformations objects to a 16-element
 * plain JS array using Matrix4 linear algebra transformation functions.
 *
 * Adapted from Vitessce: https://github.com/vitessce/vitessce/blob/c267ebecab1824dae68d6f2640a6c5ce7250efbb/packages/utils/spatial-utils/src/spatial.js#L403-L524
 *
 * @param coordinateTransformations List of objects matching the OME-NGFF v0.4 coordinateTransformations spec.
 * @param axes - Axes in OME-NGFF v0.4 format
 *
 * @returns Array of 16 numbers representing the Matrix4.
 */
export function coordinateTransformationsToMatrix(
  coordinateTransformations: Ome.CoordinateTransformation[],
  axes: Ome.Axis[],
  mat = new Matrix4().identity(),
) {
  // Apply each transformation sequentially and in order according to the OME-NGFF v0.4 spec.
  // Reference: https://ngff.openmicroscopy.org/0.4/#trafo-md
  const transforms = coordinateTransformations ?? [];
  if (transforms.length > 0) {
    log.debug("Applying coordinate transformations", {
      types: transforms.map((t) => t.type),
      transforms,
    });
  }
  for (const transform of transforms) {
    if (transform.type === "translation") {
      const { translation: axisOrderedTranslation } = transform;
      if (axisOrderedTranslation.length !== declaredAxes(transform.input, axes).length) {
        throw new Error("Length of translation array was expected to match length of axes.");
      }
      const cartesianTranslation = getCartesianTransformation(
        declaredAxes(transform.input, axes),
        axisOrderedTranslation,
        0,
      );

      mat = applyCoordinateTranslationToMatrix(mat, cartesianTranslation);
    } else if (transform.type === "scale") {
      const { scale: axisOrderedScale } = transform;
      // Add in z dimension needed for Matrix4 scale API.
      if (axisOrderedScale.length !== declaredAxes(transform.input, axes).length) {
        throw new Error("Length of scale array was expected to match length of axes.");
      }
      const cartesianTranslation = getCartesianTransformation(declaredAxes(transform.input, axes), axisOrderedScale, 1);

      mat = applyCoordinateScalingToMatrix(mat, cartesianTranslation);
    } else if (transform.type === "rotation") {
      const cartesianRotation = getCartesianMatrixTransformation(transform.rotation, {
        rowAxes: declaredAxes(transform.output, axes),
        columnAxes: declaredAxes(transform.input, axes),
      });

      mat = applyCoordinateRotationToMatrix(mat, cartesianRotation);
    } else if (transform.type === "sequence") {
      mat = coordinateTransformationsToMatrix(transform.transformations, axes, mat);
    }
    if (transform.type === "affine") {
      const cartestianAffine = getCartesianMatrixTransformation(transform.affine, {
        rowAxes: declaredAxes(transform.output, axes),
        columnAxes: declaredAxes(transform.input, axes),
      });
      const affineMat = new Matrix4(cartestianAffine);
      mat = mat.multiplyLeft(affineMat);
    }
  }

  return mat;
}

/**
 * The axes a transformation is written over, which need not be the element's own.
 *
 * A transformation written against the transformations proposal declares the coordinate
 * systems it maps between, and those may order their axes differently from each other and
 * from the element. A rasterized SpatialData label carries an affine `yx -> xy`: its rows
 * are indexed by the output axes and its columns by the input ones, and reading either
 * with the element's order swaps x for y -- which, on top of a quarter turn, reads as a
 * half turn.
 *
 * Falls back to the element's axes, which is right for every released version of NGFF,
 * where a transformation has no axes of its own to declare.
 */
function declaredAxes(side: unknown, fallback: Ome.Axis[]): Ome.Axis[] {
  if (side && typeof side === "object" && "axes" in side && Array.isArray(side.axes)) {
    return side.axes as Ome.Axis[];
  }
  return fallback;
}

function getCartesianTransformation(
  axes: Ome.Axis[],
  transformation: Array<number>,
  defaultValue: number,
): Array<number> {
  const xyzIndices = ["x", "y", "z"].map((name) =>
    axes.findIndex((axisObj) => axisObj.type === "space" && axisObj.name === name),
  );

  // Get the translation values for [x, y, z].
  return xyzIndices.map((axisIndex) => (axisIndex >= 0 ? transformation[axisIndex] : defaultValue));
}

type FlatMatrix4 = [
  m00: number,
  m01: number,
  m02: number,
  m03: number,
  m10: number,
  m11: number,
  m12: number,
  m13: number,
  m20: number,
  m21: number,
  m22: number,
  m23: number,
  m40: number,
  m41: number,
  m42: number,
  m43: number,
];

type Tuple3 = [number, number, number];

const SPATIAL_COORD_NAMES: ["x", "y", "z"] = ["x", "y", "z"];

function getCartesianMatrixTransformation(
  transformation: Array<Array<number>>,
  options: { rowAxes: Ome.Axis[]; columnAxes: Ome.Axis[] },
): FlatMatrix4 {
  const indicesIn = (axes: Ome.Axis[]) =>
    SPATIAL_COORD_NAMES.map((name) => {
      return axes.findIndex((axisObj) => axisObj.type === "space" && axisObj.name === name);
    }) as Tuple3;

  // Rows are the axes the transformation produces, columns the ones it consumes. They are
  // the same list for every released version of NGFF, and routinely are not for the
  // proposal.
  const rowIndices = indicesIn(options.rowAxes);
  const columnIndices = indicesIn(options.columnAxes);

  // An affine is declared with one more column than it has rows: the linear part, then a
  // translation. A rotation is square and has none. Both arrive here, so which it is has
  // to be read off the shape rather than assumed.
  const rank = transformation.length;
  const hasTranslation = (transformation[0]?.length ?? 0) > rank;

  // Starting from the identity, so that an axis the element does not have is left alone
  // rather than zeroed. Zeroing it makes the matrix singular -- a 2D affine on a `yx`
  // label used to produce a z scale of 0, which collapses the layer and cannot be
  // inverted -- when what an absent axis means is that nothing happens to it.
  const mat = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];

  rowIndices.forEach((outerIndex, row) => {
    if (outerIndex < 0) {
      return;
    }
    columnIndices.forEach((innerIndex, column) => {
      if (innerIndex >= 0) {
        mat[row][column] = transformation[outerIndex][innerIndex];
      }
    });
    if (hasTranslation) {
      mat[row][3] = transformation[outerIndex][rank];
    }
  });

  //Flatten it for consumption by Matrix4
  const flatMatrix = mat.flatMap((row, i) => {
    return row.flatMap((value, j) => {
      return mat[j][i];
    });
  }) as FlatMatrix4;

  //Returns a 4-by-4 matrix regardless of axes dimensions
  return flatMatrix;
}

function applyCoordinateScalingToMatrix(matrix: Matrix4, scale: Array<number>): Matrix4 {
  // Get the scale values for [x, y, z].
  const nextMat = new Matrix4().scale(scale);

  return matrix.multiplyLeft(nextMat);
}

function applyCoordinateRotationToMatrix(matrix: Matrix4, rotation: FlatMatrix4): Matrix4 {
  // Get the scale values for [x, y, z].
  const rotationMat = new Matrix4();
  rotationMat.set(...rotation);
  return matrix.multiplyLeft(rotationMat);
}

function applyCoordinateTranslationToMatrix(matrix: Matrix4, translation: Array<number>): Matrix4 {
  // Get the translation values for [x, y, z].
  const nextMat = new Matrix4().translate(translation);
  return matrix.multiplyLeft(nextMat);
}

/**
 *Get physical size for specific resolution in multiscale image
 */
export function getPhysicalSizes(axes: Ome.Axis[], transformations: Ome.CoordinateTransformation[]) {
  const ct = coordinateTransformationsToMatrix(transformations, axes);
  const matrixIndices = {
    x: 0,
    y: 5,
    z: 10,
  };
  const physicalSizes = axes
    .filter((a) => a.type === "space")
    .reduce((acc: { [key: string]: viv.PhysicalSize }, { name, unit }: Ome.Axis) => {
      acc[name] = { size: ct[matrixIndices[name as keyof typeof matrixIndices]], unit: unit ?? "" };
      return acc;
    }, {});
  // @TODO: get t size from multiscales.coordinateTransformations if axis is present
  return physicalSizes;
}
