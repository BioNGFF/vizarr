import { Matrix4 } from "math.gl";
import { getNgffAxes, isMultiscales, assert } from "./utils";
import * as zarr from "zarrita";
import type * as viv from "@vivjs/types";


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
export function coordinateTransformationsToMatrix(coordinateTransformations: Ome.CoordinateTransformation[], axes: Ome.Axis[], mat = new Matrix4().identity()) {
  // Apply each transformation sequentially and in order according to the OME-NGFF v0.4 spec.
  // Reference: https://ngff.openmicroscopy.org/0.4/#trafo-md
  for (const transform of coordinateTransformations ?? []) {
    if (transform.type === "translation") {
      console.log("Translating image")
      const { translation: axisOrderedTranslation } = transform;
      if (axisOrderedTranslation.length !== axes.length) {
        throw new Error("Length of translation array was expected to match length of axes.");
      }
      const cartesianTranslation = getCartesianTransformation(axes, axisOrderedTranslation, 0)
      mat = coordinateTransformationToMatrix('translation', cartesianTranslation, mat)

    }
    else if (transform.type === "scale") {
      console.log('Scaling image')
      const { scale: axisOrderedScale } = transform;
      // Add in z dimension needed for Matrix4 scale API.
      if (axisOrderedScale.length !== axes.length) {
        throw new Error("Length of scale array was expected to match length of axes.");
      }
      const cartesianTranslation = getCartesianTransformation(axes, axisOrderedScale, 1)
      mat = coordinateTransformationToMatrix('scale', cartesianTranslation, mat)
    }
    else if (transform.type === "rotation") {
      console.log('Rotating image')
      const { rotation: axisOrderedTranslation } = transform;
      const cartesianRotation = getCartesianMatrixTransformation(axes, transform.rotation)
      mat = coordinateTransformationToMatrix('rotation', cartesianRotation, mat)
    }
    else if (transform.type === "sequence") {
      console.log("Sequence tranformation detected")
      mat = coordinateTransformationsToMatrix(transform.transformations, axes, mat)
    }
    if (transform.type === "affine") {
      const cartestianAffine = getCartesianMatrixTransformation(axes, transform.affine)
      const affineMat = new Matrix4(cartestianAffine)
      mat = mat.multiplyLeft(affineMat)
    }
  }

  return mat;
}


function getCartesianTransformation(axes: Ome.Axis[], transformation: Array<number>, defaultValue: number): Array<number> {
  const xyzIndices = ["x", "y", "z"].map((name) =>
    axes.findIndex((axisObj) => axisObj.type === "space" && axisObj.name === name),
  );

  // Get the translation values for [x, y, z].
  return xyzIndices.map((axisIndex) =>
    axisIndex >= 0 ? transformation[axisIndex] : defaultValue,
  );

}

function getCartesianMatrixTransformation(axes: Ome.Axis[], transformation: Array<Array<number>>): Array<number> {
  const xyzIndices = ["x", "y", "z"].map((name) =>
    axes.findIndex((axisObj) => axisObj.type === "space" && axisObj.name === name),
  );

  const mat = xyzIndices.map((outerIndex) => {
    return xyzIndices.map((innerIndex) => {
      return transformation[outerIndex][innerIndex]
    })
  })

  mat[0] = [...mat[0], 0]
  mat[1] = [...mat[1], 0]
  mat[2] = [...mat[2], 0]
  mat[3] = [0, 0, 0, 1]
  console.log('Rotation matrix: ', mat)
  return [mat[0][0], mat[1][0], mat[2][0], mat[3][0], mat[0][1], mat[1][1], mat[2][1], mat[3][1], mat[0][2], mat[1][2], mat[2][2], mat[3][2], mat[0][3], mat[1][3], mat[2][3], mat[3][3]]
}

function coordinateTransformationToMatrix(type: string, transformation: Array<number>, modelMatrix: Matrix4 = new Matrix4().identity()): Matrix4 {
  switch (type) {
    case 'translation':
      return applyCoordinateTranslationToMatrix(modelMatrix, transformation)
    case 'scale':
      return applyCoordinateScalingToMatrix(modelMatrix, transformation)
    case 'rotation':
      return applyCoordinateRotationToMatrix(modelMatrix, transformation)
    default:
      assert(type === 'translation' || type === 'scale')
  }


}

function applyCoordinateScalingToMatrix(matrix: Matrix4, scale: Array<number>): Matrix4 {
  // Get the scale values for [x, y, z].
  const nextMat = new Matrix4().scale(scale);

  return matrix.multiplyLeft(nextMat);
}

function applyCoordinateRotationToMatrix(matrix: Matrix4, rotation: Array<number>): Matrix4 {
  // Get the scale values for [x, y, z].
  const rotationMat = new Matrix4()
  rotationMat.set(...rotation)
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
export function getPhysicalSizes(attrs: zarr.Attributes) {
  if (isMultiscales(attrs)) {
    const axes = getNgffAxes(attrs.multiscales);
    const ct = coordinateTransformationsToMatrix(attrs.multiscales[0].datasets[0].coordinateTransformations, axes);
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
}

