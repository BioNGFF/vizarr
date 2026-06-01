import type * as viv from "@vivjs/types";
import { Matrix4 } from "math.gl";
import * as zarr from "zarrita";
import { assert, getNgffAxes, isMultiscales } from "./utils";

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
  coordinateTransformations: Ome.CoordinateTransformationType[],
  axes: Ome.Axis[],
  mat = new Matrix4().identity(),
) {
  // Apply each transformation sequentially and in order according to the OME-NGFF v0.4 spec.
  // Reference: https://ngff.openmicroscopy.org/0.4/#trafo-md
  for (const transform of coordinateTransformations ?? []) {
    if (transform.type === "translation") {
      console.log("Translating image");
      const { translation: axisOrderedTranslation } = transform;
      console.log(transform);
      if (axisOrderedTranslation.length !== axes.length) {
        throw new Error("Length of translation array was expected to match length of axes.");
      }
      const cartesianTranslation = getCartesianTransformation(axes, axisOrderedTranslation, 0);

      mat = applyCoordinateTranslationToMatrix(mat, cartesianTranslation);
    } else if (transform.type === "scale") {
      console.log("Scaling image");
      const { scale: axisOrderedScale } = transform;
      // Add in z dimension needed for Matrix4 scale API.
      if (axisOrderedScale.length !== axes.length) {
        throw new Error("Length of scale array was expected to match length of axes.");
      }
      const cartesianTranslation = getCartesianTransformation(axes, axisOrderedScale, 1);

      mat = applyCoordinateScalingToMatrix(mat, cartesianTranslation);
    } else if (transform.type === "rotation") {
      console.log("Rotating image");
      const cartesianRotation = getCartesianMatrixTransformation(axes, transform.rotation);

      mat = applyCoordinateRotationToMatrix(mat, cartesianRotation);
    } else if (transform.type === "sequence") {
      console.log("Sequence tranformation detected");
      mat = coordinateTransformationsToMatrix(transform.transformations, axes, mat);
    }
    if (transform.type === "affine") {
      console.log("Affine transformation detected");
      // const cartestianAffine = getCartesianMatrixTransformation(axes, transform.affine)
      // const affineMat = new Matrix4(cartestianAffine)
      // mat = mat.multiplyLeft(affineMat)
    }
  }

  return mat;
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
type Tuple4 = [number, number, number, number];

const SPATIAL_COORD_NAMES: ["x", "y", "z"] = ["x", "y", "z"];

function getCartesianMatrixTransformation(axes: Ome.Axis[], transformation: Array<Array<number>>): FlatMatrix4 {
  //Ugly assertion but cannot satisfy TS that the return type of a map is a tuple, and the length needs to be known for spreading into the arguments of Matrix4
  const xyzIndices = SPATIAL_COORD_NAMES.map((name) => {
    return axes.findIndex((axisObj) => axisObj.type === "space" && axisObj.name === name);
  }) as Tuple3;

  const mat = xyzIndices.map((outerIndex) => {
    return xyzIndices.map((innerIndex) => {
      return outerIndex >= 0 && innerIndex >= 0 ? transformation[outerIndex][innerIndex] : 0;
    });
  });

  mat[0] = [...mat[0], 0];
  mat[1] = [...mat[1], 0];
  mat[2] = [...mat[2], 0];
  mat[3] = [0, 0, 0, 1];

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
  const defaultValue = 0;
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
