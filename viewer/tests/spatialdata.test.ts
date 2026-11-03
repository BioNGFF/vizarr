import { describe, expect, test } from "vitest";
import { parse } from "../src/parsers/parse";
import { normalizeSpatialDataVersions } from "../src/parsers/spatialdata";

/**
 * Taking SpatialData's suffix off the NGFF version.
 *
 * Pure and offline. What the suffix means is a reading of the specification, not an
 * observation about a server, and the one thing that could make these tests wrong is
 * SpatialData changing how it spells the suffix -- which a remote test would not catch
 * any sooner.
 */

describe("normalizeSpatialDataVersions", () => {
  test("rewrites the version where 0.5 keeps it, under `ome`", () => {
    const attrs = { ome: { version: "0.5-dev-spatialdata", multiscales: [{ name: "x" }] } };
    expect(normalizeSpatialDataVersions(attrs)).toEqual({
      ome: { version: "0.5", multiscales: [{ name: "x" }] },
    });
  });

  test("rewrites it where 0.4 keeps it, inside each multiscales entry", () => {
    const attrs = { multiscales: [{ version: "0.4-dev-spatialdata", name: "x" }] };
    expect(normalizeSpatialDataVersions(attrs)).toEqual({
      multiscales: [{ version: "0.4", name: "x" }],
    });
  });

  test("rewrites a label's version too", () => {
    const attrs = { "image-label": { version: "0.4-dev-spatialdata" }, multiscales: [] };
    expect(normalizeSpatialDataVersions(attrs)).toEqual({
      "image-label": { version: "0.4" },
      multiscales: [],
    });
  });

  test("leaves the input alone rather than editing it in place", () => {
    const attrs = { ome: { version: "0.5-dev-spatialdata" } };
    normalizeSpatialDataVersions(attrs);
    expect(attrs.ome.version).toBe("0.5-dev-spatialdata");
  });

  test.each([
    ["a released version", "0.5"],
    ["a development version of the specification itself", "0.6.dev3"],
    ["another writer's suffix", "0.5-dev-somethingelse"],
    ["something unrecognisable", "banana"],
  ])("does not touch %s", (_, version) => {
    const attrs = { ome: { version } };
    // Returned as given, so an unknown version still fails where it should, rather than
    // being guessed into something that parses.
    expect(normalizeSpatialDataVersions(attrs)).toBe(attrs);
  });
});

describe("parsing a SpatialData element", () => {
  /** An image element as spatialdata 0.7.3 writes it, trimmed to what the parser reads. */
  const image = {
    ome: {
      version: "0.5-dev-spatialdata",
      omero: { channels: [{ label: "r" }, { label: "g" }, { label: "b" }] },
      multiscales: [
        {
          name: "/images/Visium_HD_Mouse_Small_Intestine_hires_image",
          axes: [
            { name: "c", type: "channel" },
            { name: "y", type: "space" },
            { name: "x", type: "space" },
          ],
          datasets: [{ path: "s0", coordinateTransformations: [{ type: "scale", scale: [1, 1, 1] }] }],
          // The named coordinate systems, which are the reason for the suffix. Nothing
          // reads them yet; what this asserts is that carrying them is not a reason to
          // refuse the image.
          coordinateTransformations: [
            {
              type: "scale",
              scale: [1, 3.9363334282252107, 3.9363334282252107],
              input: { name: "cyx", axes: [{ name: "c", type: "channel" }] },
              output: { name: "Visium_HD_Mouse_Small_Intestine", axes: [{ name: "c", type: "channel" }] },
            },
          ],
        },
      ],
    },
    spatialdata_attrs: { version: "0.3" },
  };

  test("is recognised as a v0.5 image", () => {
    const result = parse(image);
    expect(result?.version).toBe("0.5");
    expect(result?.type).toBe("image");
  });

  test("is refused if the suffix names a version we do not have", () => {
    const future = structuredClone(image);
    future.ome.version = "0.9-dev-spatialdata";
    expect(parse(future)).toBeUndefined();
  });
});
