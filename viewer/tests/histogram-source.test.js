import { expect, test } from "vitest";

import { maxValue, percentile } from "../src/histogram";
import { canComputeHistogram, computeHistogramForSelection, histogramKey } from "../src/histogram-source";

/** Minimal stand-in for ZarrPixelSource; avoids the real requestAnimationFrame path. */
function fakeSource({ dtype, data, width = 8, height = 8, shape }) {
  let calls = 0;
  return {
    dtype,
    shape: shape ?? [1, 1, height, width],
    get calls() {
      return calls;
    },
    async getRaster() {
      calls++;
      return { data, width, height };
    },
  };
}

test("Uint8 bins over the fixed domain with one bin per intensity", async () => {
  const data = new Uint8Array(256);
  for (let i = 0; i < 256; i++) data[i] = i;

  const h = await computeHistogramForSelection(
    fakeSource({ dtype: "Uint8", data, width: 16, height: 16 }),
    [0, 0, 0, 0],
  );
  expect(h.min).toBe(0);
  expect(maxValue(h)).toBe(255);
  expect(h.binWidth).toBe(1);
  expect(h.counts.length).toBe(256);
  expect(h.integer).toBe(true);
});

test("narrow integer data gets exact one-per-intensity bins", async () => {
  const data = Uint16Array.from([10, 11, 11, 12, 13]);
  const h = await computeHistogramForSelection(fakeSource({ dtype: "Uint16", data }), [0, 0, 0, 0]);
  expect(h.integer).toBe(true);
  expect(h.binWidth).toBe(1);
  expect(h.counts.length).toBe(4);
  expect(h.counts[1]).toBe(2);
  expect(percentile(h, 1)).toBe(13);
});

test("wide integer data falls back to the default bin budget", async () => {
  const data = Uint16Array.from([0, 65535]);
  const h = await computeHistogramForSelection(fakeSource({ dtype: "Uint16", data }), [0, 0, 0, 0]);
  expect(h.counts.length).toBe(512);
  expect(h.integer).toBe(true);
});

test("float data keeps fractional percentiles", async () => {
  const data = Float32Array.from([0.5, 1.5, 2.5, 3.5]);
  const h = await computeHistogramForSelection(fakeSource({ dtype: "Float32", data }), [0, 0, 0, 0]);
  expect(h.integer).toBe(false);
  expect(h.min).toBeCloseTo(0.5, 6);
  expect(h.max).toBeCloseTo(3.5, 6);
});

test("an all-NaN float plane yields an empty histogram rather than throwing", async () => {
  const data = Float32Array.from([Number.NaN, Number.NaN]);
  const h = await computeHistogramForSelection(fakeSource({ dtype: "Float32", data }), [0, 0, 0, 0]);
  expect(h.total).toBe(0);
  expect(percentile(h, 0.5)).toBe(0);
});

test("oversized planes are rejected before any fetch", () => {
  expect(canComputeHistogram(fakeSource({ dtype: "Uint16", data: new Uint16Array(4), shape: [1, 1, 512, 512] }))).toBe(
    true,
  );
  expect(
    canComputeHistogram(fakeSource({ dtype: "Uint16", data: new Uint16Array(4), shape: [1, 1, 8192, 8192] })),
  ).toBe(false);
});

test("the cache key ignores contrast limits and tracks the selection", () => {
  expect(histogramKey("abc", [0, 2, 5, 0, 0])).toBe("abc|0,2,5,0,0");
  expect(histogramKey("abc", [0, 2, 5, 0, 0])).not.toBe(histogramKey("abc", [0, 2, 6, 0, 0]));
  expect(histogramKey("abc", [0, 1])).not.toBe(histogramKey("def", [0, 1]));
});
