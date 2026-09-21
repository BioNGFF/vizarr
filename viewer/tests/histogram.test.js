import { expect, test } from "vitest";

import {
  DEFAULT_BINS,
  barsToStepPath,
  chooseBinCount,
  computeHistogram,
  finiteMinMax,
  maxValue,
  normalizeBars,
  percentile,
  percentiles,
  resampleHistogram,
} from "../src/histogram";

/** Deterministic LCG so the distribution tests never flake. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("bins samples into the requested domain", () => {
  const h = computeHistogram(Uint8Array.from([0, 0, 1, 255]), { min: 0, max: 255, bins: 256 });
  expect(h.total).toBe(4);
  expect(h.counts[0]).toBe(2);
  expect(h.counts[1]).toBe(1);
  expect(h.counts[255]).toBe(1);
});

test("the maximum sample lands in the last bin without writing out of bounds", () => {
  const h = computeHistogram(Float32Array.from([10]), { min: 0, max: 10, bins: 4 });
  expect(h.counts.length).toBe(4);
  expect(h.counts[3]).toBe(1);
  expect(h.total).toBe(1);
});

test("a uniform plane collapses to a single bin", () => {
  const h = computeHistogram(new Uint16Array(100).fill(7));
  expect(h.min).toBe(7);
  expect(h.max).toBe(7);
  expect(h.binWidth).toBe(0);
  expect(h.counts.length).toBe(1);
  expect(h.total).toBe(100);
  for (const q of [0, 0.01, 0.5, 0.99, 1]) {
    expect(percentile(h, q)).toBe(7);
  }
});

test("NaN and infinities are excluded from range and counts", () => {
  const data = Float32Array.from([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1, 2, 3]);
  expect(finiteMinMax(data)).toEqual([1, 3]);
  const h = computeHistogram(data);
  expect(h.total).toBe(3);
});

test("finiteMinMax returns null when nothing is finite", () => {
  expect(finiteMinMax(Float32Array.from([Number.NaN, Number.POSITIVE_INFINITY]))).toBeNull();
});

test("percentiles track the exact quantiles within one bin width", () => {
  const rand = lcg(42);
  const data = new Float32Array(100_000);
  for (let i = 0; i < data.length; i++) data[i] = rand() * 1000;

  const h = computeHistogram(data);
  const sorted = Array.from(data).sort((a, b) => a - b);

  for (const q of [0.01, 0.5, 0.99]) {
    const expected = sorted[Math.floor(q * (sorted.length - 1))];
    expect(Math.abs(percentile(h, q) - expected)).toBeLessThanOrEqual(h.binWidth);
  }
});

test("integer data gets one bin per intensity and whole-number percentiles", () => {
  const data = new Uint8Array(256);
  for (let i = 0; i < 256; i++) data[i] = i;

  const h = computeHistogram(data, { min: 0, max: 255, integer: true });
  expect(h.counts.length).toBe(256);
  expect(h.binWidth).toBe(1);
  expect(h.integer).toBe(true);
  // The upper edge is exclusive, so the largest representable intensity is 255.
  expect(h.max).toBe(256);
  expect(maxValue(h)).toBe(255);
  expect(percentile(h, 1)).toBe(255);

  const mid = percentile(h, 0.5);
  expect(Number.isInteger(mid)).toBe(true);
  expect(Math.abs(mid - 127)).toBeLessThanOrEqual(1);

  // Every intensity occupies exactly one bin.
  for (const v of [0, 1, 200, 255]) {
    expect(h.counts[v]).toBe(1);
  }
});

test("percentiles are monotonic on a skewed distribution", () => {
  // 90% background zeros plus a long tail — the usual microscopy shape.
  const data = new Uint16Array(10_000);
  for (let i = 9000; i < data.length; i++) data[i] = (i - 9000) * 6;

  const h = computeHistogram(data);
  const qs = [0, 0.01, 0.5, 0.99, 1];
  const vals = percentiles(h, qs);
  for (let i = 1; i < vals.length; i++) {
    expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
  }
});

test("resampling conserves the total count over the full domain", () => {
  const rand = lcg(7);
  const data = new Float32Array(5000);
  for (let i = 0; i < data.length; i++) data[i] = rand() * 100;

  const h = computeHistogram(data);
  const bars = resampleHistogram(h, [h.min, h.max], 165);
  const sum = bars.reduce((a, b) => a + b, 0);
  expect(Math.abs(sum - h.total) / h.total).toBeLessThan(1e-3);
});

test("resampling a half domain keeps roughly half the mass", () => {
  const data = new Uint16Array(1000);
  for (let i = 0; i < data.length; i++) data[i] = i;

  const h = computeHistogram(data);
  const mid = (h.min + h.max) / 2;
  const bars = resampleHistogram(h, [h.min, mid], 100);
  const sum = bars.reduce((a, b) => a + b, 0);
  expect(Math.abs(sum - h.total / 2) / h.total).toBeLessThan(0.02);
});

test("a domain disjoint from the data resamples to all zeros", () => {
  const h = computeHistogram(Uint16Array.from([1, 2, 3, 4]));
  const bars = resampleHistogram(h, [1000, 2000], 32);
  for (const b of bars) expect(b).toBe(0);
});

test("chooseBinCount prefers exact integer bins when the span allows", () => {
  expect(chooseBinCount({ integer: true, min: 0, max: 255 })).toBe(256);
  expect(chooseBinCount({ integer: true, min: 0, max: 65535 })).toBe(DEFAULT_BINS);
  expect(chooseBinCount({ integer: false, min: 0, max: 1 })).toBe(DEFAULT_BINS);
  expect(chooseBinCount({ integer: true, min: 5, max: 5 })).toBe(1);
});

test("normalizeBars maps zero to zero and the peak to one", () => {
  const bars = Float32Array.from([0, 1, 10, 100]);
  for (const scale of ["log", "linear"]) {
    const out = normalizeBars(bars, scale);
    expect(out[0]).toBe(0);
    expect(out[3]).toBeCloseTo(1, 6);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
    }
  }
});

test("normalizeBars handles an all-zero input without NaN", () => {
  const out = normalizeBars(new Float32Array(8), "log");
  for (const v of out) expect(v).toBe(0);
});

test("log scaling lifts a small bar further than linear does", () => {
  const bars = Float32Array.from([1, 1000]);
  expect(normalizeBars(bars, "log")[0]).toBeGreaterThan(normalizeBars(bars, "linear")[0]);
});

test("barsToStepPath produces a closed path spanning the box", () => {
  const d = barsToStepPath(Float32Array.from([0, 0.5, 1]), 100, 30);
  expect(d.startsWith("M0 30")).toBe(true);
  expect(d.endsWith("Z")).toBe(true);
  expect(d).toContain("L100 30");
});
