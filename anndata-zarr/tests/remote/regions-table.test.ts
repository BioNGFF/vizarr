import { expect, test } from "vitest";
import { getInstanceValues, getRegionsTable } from "../../src/anndata";
import { getAnndataColors } from "../../src/hooks";

/**
 * A real SpatialData regions table, read end to end.
 *
 * Remote because it needs a published container, and worth the network: the thing being
 * checked is that a table's own account of which label each row describes is honoured,
 * and a fixture written to match the implementation would prove nothing about real data.
 *
 * This container's instance ids skip 7, 14, 21 and 28 across 26 rows, which is what makes
 * it a test rather than a demonstration -- by row position every row after the sixth
 * would colour the wrong object.
 */
const TABLE = new URL(
  "https://storage.googleapis.com/vitessce-demo-data/spatialdata-august-2025/blobs_with_feature_index.sdata.zarr/tables/table",
);

const EXPECTED = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 29, 30];

test("a regions table says which element it annotates and how", async () => {
  expect(await getRegionsTable(TABLE)).toEqual({
    region: "blobs_labels",
    regionKey: "region",
    instanceKey: "instance_id",
  });
});

test("instance ids are read exactly, although the column is int64", async () => {
  // int64 arrives as BigInt. Label values are small, so narrowing loses nothing, but it
  // has to be done rather than left for a schema to reject.
  expect(await getInstanceValues(TABLE, "instance_id")).toEqual(EXPECTED);
});

test("colours land on the labels the table names, gaps and all", async () => {
  const { colors } = await getAnndataColors(TABLE, { type: "observation", labelIndex: "region" });

  expect(colors.map((colour) => colour.labelValue)).toEqual(EXPECTED);
  // The failure this replaces: a dense run from 1, which is what row position produces.
  expect(colors.map((colour) => colour.labelValue)).not.toEqual(colors.map((_, index) => index + 1));
});
