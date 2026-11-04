/**
 * @module
 * Reading one column out of a sparse expression matrix.
 *
 * AnnData writes `X` as a group of three arrays when it is sparse: `data` holds the
 * non-zero values, `indices` says which row or column each belongs to, and `indptr`
 * says where each compressed slice begins. Which of the two axes is compressed is the
 * whole difference between the two encodings, and the whole difference in cost.
 */

/** The size over which a CSR matrix is not read whole. */
export const CSR_VALUE_LIMIT = 20_000_000;

export type SparseEncoding = "csr_matrix" | "csc_matrix";

/**
 * Where a gene's values sit in a column-compressed matrix.
 *
 * CSC gives `indptr` one entry per column plus one, so a gene is a contiguous run and
 * two numbers locate it. Tens of kilobytes read instead of the whole matrix -- on a
 * Visium HD table that is 4,600 values against 88 million.
 */
export function columnRange(indptr: number[], column: number): { start: number; end: number } {
  const start = indptr[column];
  const end = indptr[column + 1];
  if (start === undefined || end === undefined) {
    throw new Error(`Column ${column} is outside a matrix with ${Math.max(0, indptr.length - 1)} columns.`);
  }
  return { start, end };
}

/**
 * A dense column from the values and row numbers of one compressed column.
 *
 * Zero where the matrix stored nothing, which is what a sparse matrix means by leaving it
 * out, and what the colour scale has to be given for the rows that have no counts.
 */
export function scatterColumn(values: number[], rows: number[], length: number): number[] {
  const column = new Array<number>(length).fill(0);
  for (let i = 0; i < values.length; i++) {
    const row = rows[i];
    if (row !== undefined && row >= 0 && row < length) {
      column[row] = values[i] ?? 0;
    }
  }
  return column;
}

/**
 * A dense column picked out of a row-compressed matrix held whole.
 *
 * CSR compresses the other axis, so a gene is one element somewhere inside each row and
 * there is no slice that fetches them. Every row has to be walked. That is why this takes
 * the matrix rather than a range: the caller has already decided to read all of it.
 */
export function columnFromRows(values: number[], columns: number[], indptr: number[], column: number): number[] {
  const rows = Math.max(0, indptr.length - 1);
  const dense = new Array<number>(rows).fill(0);
  for (let row = 0; row < rows; row++) {
    const start = indptr[row] ?? 0;
    const end = indptr[row + 1] ?? start;
    for (let i = start; i < end; i++) {
      if (columns[i] === column) {
        dense[row] = values[i] ?? 0;
        break;
      }
    }
  }
  return dense;
}

/** Whether a row-compressed matrix is small enough to be worth reading whole. */
export function canReadWhole(valueCount: number, limit = CSR_VALUE_LIMIT): boolean {
  return valueCount <= limit;
}
