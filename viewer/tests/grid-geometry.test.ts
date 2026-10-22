import { expect, test } from "vitest";
import {
  type Bounds,
  type Dimensions,
  cellBoundsFor,
  intersect,
  pickLevelForScreenSize,
  windowForLevel,
} from "../src/layers/grid-layer";

/** A grid cell is placed by its row/column; only those three fields matter here. */
function at(row: number, col: number) {
  return { row, col, name: `${row}-${col}`, sources: [] };
}

const CELL: Dimensions = { width: 100, height: 100 };

test("Cells are laid out on a grid with the spacer between them, not around them", () => {
  expect(cellBoundsFor(at(0, 0), CELL, 5)).toEqual({ left: 0, top: 0, right: 100, bottom: 100 });
  // The second column starts one cell plus one spacer along.
  expect(cellBoundsFor(at(0, 1), CELL, 5)).toEqual({ left: 105, top: 0, right: 205, bottom: 100 });
  expect(cellBoundsFor(at(2, 3), CELL, 5)).toEqual({ left: 315, top: 210, right: 415, bottom: 310 });
});

test("Cells outside the viewport are culled, and ones that touch it are not", () => {
  const viewport: Bounds = { left: 0, top: 0, right: 150, bottom: 150 };
  expect(intersect(cellBoundsFor(at(0, 0), CELL, 5), viewport)).toEqual({
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
  });
  // Column 1 starts at 105, so only its first 45 units are on screen.
  expect(intersect(cellBoundsFor(at(0, 1), CELL, 5), viewport)).toEqual({
    left: 105,
    top: 0,
    right: 150,
    bottom: 100,
  });
  // Column 2 starts at 210, beyond the viewport entirely.
  expect(intersect(cellBoundsFor(at(0, 2), CELL, 5), viewport)).toBeNull();
});

test("Cells touching only at an edge are culled, as they would draw nothing", () => {
  const cell: Bounds = { left: 0, top: 0, right: 100, bottom: 100 };
  expect(intersect(cell, { left: 100, top: 0, right: 200, bottom: 100 })).toBeNull();
});

test("A fully visible cell is read whole, exactly as before windowing existed", () => {
  const cellBounds = cellBoundsFor(at(0, 0), CELL, 0);
  const result = windowForLevel({
    visibleBounds: cellBounds,
    cellBounds,
    fullSize: CELL,
    levelSize: { width: 50, height: 50 },
  });
  expect(result.window).toBeUndefined();
  expect(result.renderBounds).toEqual(cellBounds);
});

test("A partly visible cell is read as the window covering the visible part", () => {
  const cellBounds = cellBoundsFor(at(0, 0), CELL, 0);
  // The right half of a 100-unit cell, against a level of 50 pixels: 2 units per pixel.
  const result = windowForLevel({
    visibleBounds: { left: 50, top: 0, right: 100, bottom: 100 },
    cellBounds,
    fullSize: CELL,
    levelSize: { width: 50, height: 50 },
  });
  expect(result.window).toEqual({ x: [25, 50], y: [0, 50] });
  // Bounds snap to pixel edges so the texture lands on the data it came from.
  expect(result.renderBounds).toEqual({ left: 50, top: 0, right: 100, bottom: 100 });
});

test("A window is clamped to the level and never collapses to nothing", () => {
  const cellBounds = cellBoundsFor(at(0, 0), CELL, 0);
  // A viewport beyond the cell on both axes, as panning past the edge produces.
  const result = windowForLevel({
    visibleBounds: { left: -500, top: -500, right: 5000, bottom: 5000 },
    cellBounds,
    fullSize: CELL,
    levelSize: { width: 50, height: 50 },
  });
  expect(result.window).toBeUndefined();

  // A viewport so small it rounds to zero width still asks for at least one pixel.
  const sliver = windowForLevel({
    visibleBounds: { left: 0, top: 0, right: 0.5, bottom: 0.5 },
    cellBounds,
    fullSize: CELL,
    levelSize: { width: 50, height: 50 },
  });
  expect(sliver.window?.x[1]).toBeGreaterThan(sliver.window?.x[0] ?? 0);
  expect(sliver.window?.y[1]).toBeGreaterThan(sliver.window?.y[0] ?? 0);
});

test("The chosen level is the sharpest that is not oversampled", () => {
  // A pyramid halving each step, as multiscales conventionally do.
  const levels: Dimensions[] = [
    { width: 800, height: 800 },
    { width: 400, height: 400 },
    { width: 200, height: 200 },
    { width: 100, height: 100 },
  ];
  // Zoomed in far enough to want full resolution.
  expect(pickLevelForScreenSize(levels, { width: 900, height: 900 })).toBe(0);
  // 300 screen pixels: level 0 would be 0.375 px per pixel, level 1 is 0.75.
  expect(pickLevelForScreenSize(levels, { width: 300, height: 300 })).toBe(1);
  // A thumbnail-sized cell, as a whole plate zoomed out gives.
  expect(pickLevelForScreenSize(levels, { width: 60, height: 60 })).toBe(3);
});

test("A cell smaller on screen than even the coarsest level still picks one", () => {
  const levels: Dimensions[] = [
    { width: 800, height: 800 },
    { width: 400, height: 400 },
  ];
  expect(pickLevelForScreenSize(levels, { width: 1, height: 1 })).toBe(1);
});

test("The narrower axis decides the level, so neither axis is ever undersampled", () => {
  const levels: Dimensions[] = [
    { width: 800, height: 800 },
    { width: 400, height: 400 },
  ];
  // Wide but short: height alone would allow level 0, width would not.
  expect(pickLevelForScreenSize(levels, { width: 1000, height: 100 })).toBe(1);
});
