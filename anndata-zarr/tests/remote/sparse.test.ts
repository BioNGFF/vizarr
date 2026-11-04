import { expect, test } from "vitest";
import { getAnndataColors } from "../../src/hooks";

/**
 * Colouring by a gene from each of the two sparse encodings, against real tables.
 *
 * Remote, because what is being checked is that the arrays are laid out as the format
 * says and the reads land on the right values -- which a fixture written to match the
 * implementation could not show. The logic itself is pinned down offline in
 * `tests/sparse.test.ts`.
 */

const VISIUM_HD = new URL(
  "https://storage.googleapis.com/vitessce-demo-data/spatialdata-august-2025/visium_hd_3.0.0.spatialdata.zarr/tables/square_016um",
);

const BLOBS = new URL(
  "https://storage.googleapis.com/vitessce-demo-data/spatialdata-august-2025/blobs_with_feature_index.sdata.zarr/tables/table",
);

test("a column-compressed matrix is read a gene at a time", async () => {
  // 91,033 x 19,059 with 87,983,720 non-zeros. Reading the whole matrix to colour one
  // gene would be 352 MB; this fetches the gene's own slice.
  const { colors } = await getAnndataColors(VISIUM_HD, { type: "feature", labelIndex: "Xkr4" });

  expect(colors).toHaveLength(91033);
  // Sparse: most squares have no counts for any one gene, and the rest are what colours.
  const expressed = colors.filter((colour) => Number(colour.value) > 0);
  expect(expressed.length).toBeGreaterThan(0);
  expect(expressed.length).toBeLessThan(colors.length);
});

test("a row-compressed matrix is read whole, while it is small", async () => {
  // 26 x 3. A gene here is one element inside each of the 26 rows, so there is no slice
  // to ask for and the matrix is read entirely.
  const { colors } = await getAnndataColors(BLOBS, { type: "feature", labelIndex: "channel_0_sum" });

  expect(colors).toHaveLength(26);
  expect(colors.every((colour) => Number.isFinite(Number(colour.value)))).toBe(true);
});

test("the colour lands on the label its row names, not on its position", async () => {
  // The two halves together. #171 settled which label a row's colour belongs to; this
  // reads the value from a sparse matrix. The ids of this table skip 7, 14, 21 and 28,
  // so a colour on label 7 would mean the value had been placed by row order after all.
  const { colors } = await getAnndataColors(BLOBS, { type: "feature", labelIndex: "channel_0_sum" });

  expect(colors.map((colour) => colour.labelValue)).not.toContain(7);
  expect(colors.at(-1)?.labelValue).toBe(30);
});
