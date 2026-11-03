import { describe, expect, test } from "vitest";
import { isSpatialDataRoot, listSpatialDataElements } from "../src/parsers/spatialdata";
import { chooseSharedCoordinateSystem } from "../src/providers/spatialdata";

/**
 * Finding what a SpatialData container holds, and which space to show it in.
 *
 * Both zarr formats appear here because both are in the wild: spatialdata 0.4 wrote v2
 * containers, 0.7 writes v3, and their indexes are keyed differently. This is pure, so
 * the shapes are written down rather than fetched -- the real containers are read in
 * `tests/local-fixtures.test.ts` against a fixture, and the formats themselves change
 * slowly enough that a test is the right place to record them.
 */

/** A v3 index: keyed by node path, attributes nested inside the node. */
const V3_INDEX = {
  images: { node_type: "group", attributes: {} },
  "images/full": {
    node_type: "group",
    attributes: {
      ome: {
        multiscales: [
          {
            coordinateTransformations: [{ type: "identity", output: { name: "sample" } }],
          },
        ],
      },
    },
  },
  "images/hires": {
    node_type: "group",
    attributes: {
      ome: {
        multiscales: [
          {
            coordinateTransformations: [
              { type: "identity", output: { name: "hires-pixels" } },
              { type: "scale", output: { name: "sample" } },
            ],
          },
        ],
      },
    },
  },
  "images/full/s0": { node_type: "array", attributes: {} },
  "shapes/cells": { node_type: "group", attributes: {} },
  "tables/table": { node_type: "group", attributes: {} },
};

/** A v2 index: keyed by metadata file, the entry being the attributes themselves. */
const V2_INDEX = {
  ".zgroup": { zarr_format: 2 },
  "images/blobs_image/.zattrs": {
    multiscales: [{ coordinateTransformations: [{ type: "identity", output: { name: "global" } }] }],
  },
  "images/blobs_image/.zgroup": { zarr_format: 2 },
  "images/blobs_image/0/.zarray": { shape: [1, 1] },
  "labels/blobs_labels/.zattrs": { multiscales: [] },
  "points/blobs_points/.zattrs": {},
};

describe("isSpatialDataRoot", () => {
  test("recognises a container root", () => {
    expect(isSpatialDataRoot({ spatialdata_attrs: { version: "0.2" } })).toBe(true);
  });

  test.each([
    ["an element, which carries the same key", { spatialdata_attrs: { version: "0.3" }, ome: { multiscales: [] } }],
    ["a v2 element", { spatialdata_attrs: { version: "0.2" }, multiscales: [] }],
    ["an ordinary image", { multiscales: [] }],
  ])("does not mistake %s for one", (_, attrs) => {
    expect(isSpatialDataRoot(attrs)).toBe(false);
  });
});

describe("listSpatialDataElements", () => {
  test("reads a zarr v3 index", () => {
    const elements = listSpatialDataElements(V3_INDEX);
    expect(elements.map((element) => element.path)).toEqual([
      "images/full",
      "images/hires",
      "shapes/cells",
      "tables/table",
    ]);
  });

  test("reads a zarr v2 index, whose keys name metadata files", () => {
    const elements = listSpatialDataElements(V2_INDEX);
    expect(elements.map((element) => element.path)).toEqual([
      "images/blobs_image",
      "labels/blobs_labels",
      "points/blobs_points",
    ]);
  });

  test("ignores everything that is not an element", () => {
    // An index describes every array and group beneath the elements too, and the group
    // each kind lives in. None of those is an element.
    const paths = listSpatialDataElements(V3_INDEX).map((element) => element.path);
    expect(paths).not.toContain("images");
    expect(paths).not.toContain("images/full/s0");
  });

  test("keeps the metadata it found, so nothing has to be fetched twice", () => {
    const [full] = listSpatialDataElements(V3_INDEX);
    expect(full?.attributes).toHaveProperty("ome");
  });
});

describe("chooseSharedCoordinateSystem", () => {
  test("picks the space the most elements name", () => {
    // `sample` is named by both; `hires-pixels` only by the image it belongs to. Elements
    // relate to each other through nothing else, so a shared space is the only one in
    // which showing them together means anything.
    const images = listSpatialDataElements(V3_INDEX).filter((element) => element.kind === "images");
    expect(chooseSharedCoordinateSystem(images)).toBe("sample");
  });

  test("works on a v2 container too", () => {
    const images = listSpatialDataElements(V2_INDEX).filter((element) => element.kind === "images");
    expect(chooseSharedCoordinateSystem(images)).toBe("global");
  });

  test("returns nothing where no element names a space", () => {
    const images = listSpatialDataElements({ "images/x": { attributes: {} } });
    expect(chooseSharedCoordinateSystem(images)).toBeUndefined();
  });
});
