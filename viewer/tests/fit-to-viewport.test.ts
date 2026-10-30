import { expect, test } from "vitest";
import { fitImageToViewport } from "../src/utils";

const IMAGE = { width: 400, height: 200 };
const VIEWPORT = { width: 1000, height: 500 };

/** Where a world point lands on screen, given deck's centre-on-target convention. */
function screenX(worldX: number, target: number, zoom: number, viewportWidth: number) {
  return viewportWidth / 2 + (worldX - target) * 2 ** zoom;
}

test("Without a panel the image is centred on the whole viewport", () => {
  const { zoom, target } = fitImageToViewport({ image: IMAGE, viewport: VIEWPORT, padding: 0 });
  expect(target).toEqual([200, 100]);
  // Height is the tighter constraint here: 500/200 beats 1000/400.
  expect(zoom).toBeCloseTo(Math.log2(2.5), 10);
});

test("A panel narrows what there is to fit into, so the image is drawn smaller", () => {
  const full = fitImageToViewport({ image: IMAGE, viewport: VIEWPORT, padding: 0 });
  const inset = fitImageToViewport({ image: IMAGE, viewport: VIEWPORT, padding: 0, insetLeft: 300 });
  // 700px of width now, so width becomes the constraint at 700/400.
  expect(inset.zoom).toBeCloseTo(Math.log2(1.75), 10);
  expect(inset.zoom).toBeLessThan(full.zoom);
});

test("The image is centred in the space the panel leaves, not behind it", () => {
  const insetLeft = 300;
  const { zoom, target } = fitImageToViewport({ image: IMAGE, viewport: VIEWPORT, padding: 0, insetLeft });
  const centre = screenX(IMAGE.width / 2, target[0], zoom, VIEWPORT.width);
  // The uncovered strip runs from 300 to 1000, so its middle is 650.
  expect(centre).toBeCloseTo(insetLeft + (VIEWPORT.width - insetLeft) / 2, 6);
});

test("Both image edges stay inside the uncovered strip", () => {
  const insetLeft = 340;
  const padding = 20;
  const { zoom, target } = fitImageToViewport({ image: IMAGE, viewport: VIEWPORT, padding, insetLeft });
  const left = screenX(0, target[0], zoom, VIEWPORT.width);
  const right = screenX(IMAGE.width, target[0], zoom, VIEWPORT.width);
  expect(left).toBeGreaterThanOrEqual(insetLeft);
  expect(right).toBeLessThanOrEqual(VIEWPORT.width);
});

test("A collapsed panel behaves exactly as no panel at all", () => {
  const none = fitImageToViewport({ image: IMAGE, viewport: VIEWPORT, padding: 10 });
  const collapsed = fitImageToViewport({ image: IMAGE, viewport: VIEWPORT, padding: 10, insetLeft: 0 });
  expect(collapsed).toEqual(none);
});

test("A panel wider than the viewport still produces a usable view", () => {
  const { zoom, target } = fitImageToViewport({
    image: IMAGE,
    viewport: VIEWPORT,
    padding: 0,
    insetLeft: VIEWPORT.width + 200,
  });
  expect(Number.isFinite(zoom)).toBe(true);
  expect(target.every(Number.isFinite)).toBe(true);
});
