import { describe, expect, test } from "vitest";
import { getColors } from "../src/utils";

/**
 * Which label a row's colour belongs to.
 *
 * Offline, because this is the mapping itself rather than anything about a file. The
 * mapping is also the part that was wrong: row position stands in for a label value only
 * where the rows are a dense run from 1 covering the whole mask.
 */

const colourArgs = { max: 1, min: 0 };

describe("getColors", () => {
  test("falls back to row position when the table names no instances", () => {
    // What a plain AnnData table gets, and what every table used to get.
    const colours = getColors({ data: [0.1, 0.2, 0.3], ...colourArgs });
    expect(colours.map((colour) => colour.labelValue)).toEqual([1, 2, 3]);
  });

  test("uses the instance each row names", () => {
    const colours = getColors({ data: [0.1, 0.2, 0.3], labelValues: [1, 2, 4], ...colourArgs });
    expect(colours.map((colour) => colour.labelValue)).toEqual([1, 2, 4]);
  });

  test("carries a gap in the instances through to the labels", () => {
    // The published blobs table skips 7, 14, 21 and 28 across 26 rows. By position the
    // seventh row would colour label 7, which belongs to an object the table has nothing
    // to say about, and every row after it would be wrong too.
    const data = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    const labelValues = [1, 2, 3, 4, 5, 6, 8];
    const colours = getColors({ data, labelValues, ...colourArgs });
    expect(colours.at(-1)?.labelValue).toBe(8);
    expect(colours.map((colour) => colour.labelValue)).not.toContain(7);
  });

  test("falls back per row, where a table names fewer instances than it has rows", () => {
    // Not expected, but a short column should not silently shift every later row.
    const colours = getColors({ data: [0.1, 0.2, 0.3], labelValues: [5], ...colourArgs });
    expect(colours.map((colour) => colour.labelValue)).toEqual([5, 2, 3]);
  });

  test("keeps one colour per row", () => {
    const colours = getColors({ data: [0.1, 0.2], labelValues: [11, 12], ...colourArgs });
    expect(colours).toHaveLength(2);
    expect(colours.every((colour) => colour.rgba.length === 4)).toBe(true);
  });
});
