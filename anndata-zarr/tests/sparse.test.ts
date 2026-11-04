import { describe, expect, test } from "vitest";
import { CSR_VALUE_LIMIT, canReadWhole, columnFromRows, columnRange, scatterColumn } from "../src/sparse";

/**
 * Reading one gene out of a sparse matrix.
 *
 * The worked example throughout is this 4 x 3 matrix, which has a hole in every place
 * worth having one: an empty row, an empty column, and a column whose values are not in
 * row order.
 *
 *     row 0 | 5 . 1
 *     row 1 | . . .
 *     row 2 | . . 7
 *     row 3 | 2 . .
 */

/** By column: column 0 is rows 0 and 3, column 1 is empty, column 2 is rows 0 and 2. */
const CSC = {
  data: [5, 2, 1, 7],
  indices: [0, 3, 0, 2],
  indptr: [0, 2, 2, 4],
};

/** By row: row 1 contributes nothing, so its pointer does not advance. */
const CSR = {
  data: [5, 1, 7, 2],
  indices: [0, 2, 2, 0],
  indptr: [0, 2, 2, 3, 4],
};

describe("columnRange", () => {
  test("locates a column from two entries of indptr", () => {
    expect(columnRange(CSC.indptr, 0)).toEqual({ start: 0, end: 2 });
    expect(columnRange(CSC.indptr, 2)).toEqual({ start: 2, end: 4 });
  });

  test("gives an empty range for a column with no values", () => {
    // A gene expressed nowhere. Not an error, and nothing to fetch.
    expect(columnRange(CSC.indptr, 1)).toEqual({ start: 2, end: 2 });
  });

  test("refuses a column the matrix does not have", () => {
    expect(() => columnRange(CSC.indptr, 3)).toThrow(/3 columns/);
  });
});

describe("scatterColumn", () => {
  test("puts each value at the row it names", () => {
    const { start, end } = columnRange(CSC.indptr, 0);
    const column = scatterColumn(CSC.data.slice(start, end), CSC.indices.slice(start, end), 4);
    expect(column).toEqual([5, 0, 0, 2]);
  });

  test("fills the rows the matrix left out with zero", () => {
    // What a sparse matrix means by leaving a value out, and what the colour scale needs
    // for the rows with no counts.
    const { start, end } = columnRange(CSC.indptr, 2);
    expect(scatterColumn(CSC.data.slice(start, end), CSC.indices.slice(start, end), 4)).toEqual([1, 0, 7, 0]);
  });

  test("is all zeros for an empty column", () => {
    expect(scatterColumn([], [], 4)).toEqual([0, 0, 0, 0]);
  });

  test("ignores a row number outside the matrix rather than growing the column", () => {
    expect(scatterColumn([9], [99], 4)).toEqual([0, 0, 0, 0]);
  });
});

describe("columnFromRows", () => {
  test("reads the same columns as the column-compressed form", () => {
    // The two encodings describe the same matrix, so they must agree.
    for (const column of [0, 1, 2]) {
      const { start, end } = columnRange(CSC.indptr, column);
      const fromColumns = scatterColumn(CSC.data.slice(start, end), CSC.indices.slice(start, end), 4);
      expect(columnFromRows(CSR.data, CSR.indices, CSR.indptr, column)).toEqual(fromColumns);
    }
  });

  test("gives a row with no values a zero", () => {
    expect(columnFromRows(CSR.data, CSR.indices, CSR.indptr, 0)[1]).toBe(0);
  });

  test("returns one value per row", () => {
    expect(columnFromRows(CSR.data, CSR.indices, CSR.indptr, 2)).toHaveLength(4);
  });
});

describe("canReadWhole", () => {
  test("allows a matrix small enough to fetch entirely", () => {
    // mibitof holds 119,124 values; the whole thing is under half a megabyte.
    expect(canReadWhole(119_124)).toBe(true);
  });

  test("refuses one that is not", () => {
    // The Visium HD table holds 87,983,720. Were it row-compressed, colouring one gene
    // would mean fetching all of them.
    expect(canReadWhole(87_983_720)).toBe(false);
  });

  test("allows exactly the limit", () => {
    expect(canReadWhole(CSR_VALUE_LIMIT)).toBe(true);
  });
});
