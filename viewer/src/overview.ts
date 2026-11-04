/**
 * @module
 * The geometry behind the overview: what it frames, where it sits, and what it outlines.
 *
 * All of it is arithmetic on a view state, so all of it is here rather than in the
 * component, where it could only be checked by looking at the screen. The rectangle in
 * particular is the inverse of `fitImageToViewport`, and getting it subtly wrong draws a
 * box that is plausible and in the wrong place.
 */

import type { Matrix4 } from "math.gl";
import type { ViewState } from "./state";

/** A rectangle in world coordinates. */
export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Where the overview sits on the canvas, in pixels from the top left. */
export interface OverviewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How the overview is sized, following Viv's long-standing defaults so that an overview
 * here is the size people expect one to be.
 */
export const OVERVIEW_DEFAULTS = {
  /** Fraction of the viewport's width to aim for. */
  scale: 0.2,
  /** Distance from the corner, in pixels. */
  margin: 25,
  /** Bounds on the width the fraction above is allowed to produce. */
  minimumWidth: 150,
  maximumWidth: 350,
  /** The box is shrunk to fit inside these, keeping its shape. */
  maximumHeight: 350,
  /**
   * Room left between the image and the edge of the overview.
   *
   * None. The overview's viewport is cleared, so any room left here shows as a band of
   * background between the outline and the edge of the corner it occupies -- a margin
   * around a margin. The outline is the edge.
   */
  padding: 0,
};

/** What a layer covers once its model matrix has been applied. */
export function layerExtent(size: { width: number; height: number }, matrix?: Matrix4): Extent {
  const corners: Array<[number, number, number]> = [
    [0, 0, 0],
    [size.width, 0, 0],
    [size.width, size.height, 0],
    [0, size.height, 0],
  ];
  const points = matrix ? corners.map((corner) => matrix.transformAsPoint(corner)) : corners;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/**
 * Everything the sources cover between them, or undefined where there is nothing.
 *
 * The union rather than the first source, unlike the scale bar and the orientation
 * compass. Those describe a frame of reference, and several images can disagree about
 * one; this describes where you are looking, and that answer is the same whatever is
 * drawn. For elements registered against each other -- which is the ordinary case in a
 * SpatialData container -- framing only the first would cut off the rest.
 */
export function unionExtent(extents: Extent[]): Extent | undefined {
  if (extents.length === 0) {
    return undefined;
  }
  return extents.reduce((union, extent) => ({
    minX: Math.min(union.minX, extent.minX),
    maxX: Math.max(union.maxX, extent.maxX),
    minY: Math.min(union.minY, extent.minY),
    maxY: Math.max(union.maxY, extent.maxY),
  }));
}

/**
 * The corners of what a view state can see, in world coordinates.
 *
 * An orthographic view puts `target` at the centre of the viewport and shows `2 ** zoom`
 * pixels per world unit, so half the viewport in world units is its half-size divided by
 * that scale. The whole canvas is used, including the strip the controls panel covers:
 * the panel floats over the view rather than narrowing it, and the pixels beneath it are
 * part of what is being looked at.
 */
export function viewportCorners(viewState: ViewState): Array<[number, number]> {
  const scale = 2 ** viewState.zoom;
  const halfWidth = (viewState.width ?? 0) / 2 / scale;
  const halfHeight = (viewState.height ?? 0) / 2 / scale;
  const [x, y] = viewState.target;
  return [
    [x - halfWidth, y - halfHeight],
    [x + halfWidth, y - halfHeight],
    [x + halfWidth, y + halfHeight],
    [x - halfWidth, y + halfHeight],
  ];
}

/** The four corners of an extent, as a closed ring for a polygon layer. */
export function extentCorners(extent: Extent): Array<[number, number]> {
  return [
    [extent.minX, extent.minY],
    [extent.maxX, extent.minY],
    [extent.maxX, extent.maxY],
    [extent.minX, extent.maxY],
  ];
}

/**
 * Where to put the overview, given the canvas and the shape of what it frames.
 *
 * The box always has the shape of what it shows. Its width starts at a fraction of the
 * viewport and is bounded, and the whole box is then shrunk to fit the maxima, keeping
 * its proportions. The alternative -- bounding both sides independently -- gives a box of
 * the wrong shape with the image letterboxed inside it, which wastes the corner and makes
 * a wide slide look square.
 *
 * So the lower bound applies to the starting width only. A very tall image gets a narrow
 * strip, which is what it is.
 */
export function overviewBox(
  viewport: { width: number; height: number },
  extent: Extent,
  options: Partial<typeof OVERVIEW_DEFAULTS> = {},
): OverviewBox {
  const { scale, margin, minimumWidth, maximumWidth, maximumHeight } = { ...OVERVIEW_DEFAULTS, ...options };
  const extentWidth = Math.max(1e-9, extent.maxX - extent.minX);
  const extentHeight = Math.max(1e-9, extent.maxY - extent.minY);
  const aspect = extentHeight / extentWidth;

  let width = clamp(viewport.width * scale, minimumWidth, maximumWidth);
  let height = width * aspect;
  if (height > maximumHeight) {
    height = maximumHeight;
    width = height / aspect;
  }
  if (width > maximumWidth) {
    width = maximumWidth;
    height = width * aspect;
  }

  // Bottom right. The left is the controls panel's, the bottom left belongs to the
  // orientation compass, and the bottom centre is where warnings appear.
  return {
    x: Math.max(0, viewport.width - width - margin),
    y: Math.max(0, viewport.height - height - margin),
    width,
    height,
  };
}

/** A view state framing the whole extent inside a box of the given size. */
export function fitExtentToBox(extent: Extent, box: { width: number; height: number }, padding: number): ViewState {
  const extentWidth = Math.max(1e-9, extent.maxX - extent.minX);
  const extentHeight = Math.max(1e-9, extent.maxY - extent.minY);
  const scale = Math.min(
    Math.max(1, box.width - 2 * padding) / extentWidth,
    Math.max(1, box.height - 2 * padding) / extentHeight,
  );
  return {
    zoom: Math.log2(scale),
    target: [(extent.minX + extent.maxX) / 2, (extent.minY + extent.maxY) / 2],
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
