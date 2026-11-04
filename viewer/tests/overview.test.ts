import { Matrix4 } from "math.gl";
import { describe, expect, test } from "vitest";
import { type Extent, fitExtentToBox, layerExtent, overviewBox, unionExtent, viewportCorners } from "../src/overview";
import type { ViewState } from "../src/state";

/**
 * The geometry of the overview.
 *
 * Worth testing rather than looking at, because every mistake available here draws a
 * rectangle: in the wrong place, the wrong size, or around the wrong thing. None of them
 * throws, and on an unfamiliar image none of them looks obviously wrong.
 */

const viewState = (over: Partial<ViewState> = {}): ViewState => ({
  target: [0, 0],
  zoom: 0,
  width: 800,
  height: 600,
  ...over,
});

describe("viewportCorners", () => {
  test("covers the whole canvas at zoom 0, where a pixel is a world unit", () => {
    expect(viewportCorners(viewState())).toEqual([
      [-400, -300],
      [400, -300],
      [400, 300],
      [-400, 300],
    ]);
  });

  test("halves in world units for each step of zoom in", () => {
    // Zooming in shows less of the image, not more.
    const corners = viewportCorners(viewState({ zoom: 1 }));
    expect(corners[0]).toEqual([-200, -150]);
    expect(corners[2]).toEqual([200, 150]);
  });

  test("is centred on the target", () => {
    const corners = viewportCorners(viewState({ target: [1000, 500] }));
    expect(corners[0]).toEqual([600, 200]);
    expect(corners[2]).toEqual([1400, 800]);
  });

  test("uses the whole canvas, including the strip the panel covers", () => {
    // The panel floats over the view rather than narrowing it, so the pixels beneath it
    // are part of what is being looked at and belong inside the rectangle.
    expect(viewportCorners(viewState())[0]?.[0]).toBe(-400);
  });
});

describe("layerExtent", () => {
  test("is the image itself without a matrix", () => {
    expect(layerExtent({ width: 100, height: 50 })).toEqual({ minX: 0, maxX: 100, minY: 0, maxY: 50 });
  });

  test("follows a scale", () => {
    const matrix = new Matrix4().scale([2, 3, 1]);
    expect(layerExtent({ width: 100, height: 50 }, matrix)).toEqual({ minX: 0, maxX: 200, minY: 0, maxY: 150 });
  });

  test("stays a rectangle under a quarter turn", () => {
    // A rotated image covers a different box than its own width and height, which is the
    // ordinary case for a rasterized SpatialData label.
    const matrix = new Matrix4().rotateZ(Math.PI / 2);
    const extent = layerExtent({ width: 100, height: 50 }, matrix);
    expect(Math.round(extent.maxX - extent.minX)).toBe(50);
    expect(Math.round(extent.maxY - extent.minY)).toBe(100);
  });
});

describe("unionExtent", () => {
  const a: Extent = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
  const b: Extent = { minX: 5, maxX: 30, minY: -5, maxY: 6 };

  test("covers everything given to it", () => {
    expect(unionExtent([a, b])).toEqual({ minX: 0, maxX: 30, minY: -5, maxY: 10 });
  });

  test("is the one extent where there is only one", () => {
    expect(unionExtent([a])).toEqual(a);
  });

  test("is undefined where there is nothing", () => {
    expect(unionExtent([])).toBeUndefined();
  });
});

describe("overviewBox", () => {
  const square: Extent = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

  test("sits in the bottom right, clear of the margin", () => {
    const box = overviewBox({ width: 1200, height: 800 }, square);
    expect(box.x + box.width).toBe(1200 - 25);
    expect(box.y + box.height).toBe(800 - 25);
  });

  test("keeps the proportions of what it frames", () => {
    const wide: Extent = { minX: 0, maxX: 400, minY: 0, maxY: 100 };
    const box = overviewBox({ width: 1200, height: 800 }, wide);
    expect(box.height / box.width).toBeCloseTo(0.25, 5);
  });

  test("does not grow past its maximum on a large canvas", () => {
    const box = overviewBox({ width: 4000, height: 3000 }, square);
    expect(box.width).toBe(350);
  });

  test("does not shrink past its minimum on a small one", () => {
    const box = overviewBox({ width: 400, height: 300 }, square);
    expect(box.width).toBe(150);
  });

  test("narrows a tall image rather than letterboxing it", () => {
    // The box is shrunk to fit the maximum height and keeps its shape, so a tall image
    // gets a narrow strip instead of a square with the image stranded in the middle.
    const tall: Extent = { minX: 0, maxX: 100, minY: 0, maxY: 1000 };
    const box = overviewBox({ width: 1200, height: 900 }, tall);
    expect(box.height).toBe(350);
    expect(box.width).toBe(35);
    expect(box.height / box.width).toBeCloseTo(10, 5);
  });

  test("stays on the canvas when the canvas is smaller than the overview", () => {
    const box = overviewBox({ width: 120, height: 100 }, square);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
  });
});

describe("fitExtentToBox", () => {
  test("centres on the extent", () => {
    const state = fitExtentToBox({ minX: 100, maxX: 300, minY: 0, maxY: 100 }, { width: 200, height: 200 }, 0);
    expect(state.target).toEqual([200, 50]);
  });

  test("fits the longer side", () => {
    // 200 wide into 100 of box is a scale of a half, which is a zoom of -1.
    const state = fitExtentToBox({ minX: 0, maxX: 200, minY: 0, maxY: 50 }, { width: 100, height: 100 }, 0);
    expect(state.zoom).toBe(-1);
  });

  test("leaves the padding free", () => {
    const state = fitExtentToBox({ minX: 0, maxX: 100, minY: 0, maxY: 100 }, { width: 120, height: 120 }, 10);
    expect(2 ** state.zoom).toBeCloseTo(1, 5);
  });
});
