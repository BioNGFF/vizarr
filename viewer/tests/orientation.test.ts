import { Matrix4 } from "math.gl";
import { describe, expect, test } from "vitest";
import { hasScreenOrientation, resolveScreenOrientation, splitOrientation } from "../src/orientation";

/**
 * Placing RFC-4 orientation on screen. Offline, and pure: the hard part is the geometry,
 * and it is worth testing somewhere a flipped transform can be written down by hand
 * rather than hunted for in real data.
 */

const space = (name: string, value?: string): Ome.Axis => ({
  name,
  type: "space",
  ...(value ? { orientation: { type: "anatomical", value } } : {}),
});

/** The RFC's own example, which is also what the local fixtures carry. */
const RFC_EXAMPLE = [
  space("z", "superior-to-inferior"),
  space("y", "anterior-to-posterior"),
  space("x", "right-to-left"),
];

const identity = () => new Matrix4().identity();

describe("splitOrientation", () => {
  test("splits a direction pair into its ends", () => {
    expect(splitOrientation("left-to-right")).toEqual({ from: "left", to: "right" });
    expect(splitOrientation("superficial-to-deep")).toEqual({ from: "superficial", to: "deep" });
  });

  // "dorsal-to-palmar" and "palmar-to-dorsal" both contain "-to-" twice over if split
  // naively on "to"; the separator has to be the whole "-to-".
  test("handles terms that contain the separator's letters", () => {
    expect(splitOrientation("rostral-to-caudal")).toEqual({ from: "rostral", to: "caudal" });
    expect(splitOrientation("apex-to-base")).toEqual({ from: "apex", to: "base" });
  });

  test("rejects anything that is not a pair", () => {
    expect(splitOrientation("LPS")).toBeNull();
    expect(splitOrientation("left-to-")).toBeNull();
    expect(splitOrientation("")).toBeNull();
  });
});

describe("resolveScreenOrientation", () => {
  test("puts each end of an in-plane axis against the edge it points at", () => {
    const { edges } = resolveScreenOrientation(RFC_EXAMPLE, identity());

    // x runs right-to-left, and screen x increases rightwards, so moving right across
    // the image moves towards the subject's left. This is the radiological convention,
    // and getting it the other way round is the whole reason the flipped twins exist.
    expect(edges.left).toBe("right");
    expect(edges.right).toBe("left");
    // Screen y increases downwards, so the lowest coordinate is at the top.
    expect(edges.top).toBe("anterior");
    expect(edges.bottom).toBe("posterior");
  });

  test("reports an axis perpendicular to the view separately, not at an edge", () => {
    const { edges, throughPlane } = resolveScreenOrientation(RFC_EXAMPLE, identity());

    expect(throughPlane.z).toEqual({ from: "superior", to: "inferior" });
    expect(Object.keys(throughPlane)).toEqual(["z"]);
    expect([edges.left, edges.right, edges.top, edges.bottom]).not.toContain("superior");
  });

  // The point of going through the matrix at all. A transform that mirrors the image
  // has already been applied to the pixels, so the labels have to follow it.
  test("follows a negative scale, rather than reading the axis order", () => {
    const flipped = new Matrix4().scale([-1, 1, 1]);
    const { edges } = resolveScreenOrientation(RFC_EXAMPLE, flipped);

    expect(edges.left).toBe("left");
    expect(edges.right).toBe("right");
    // The untouched axis stays where it was.
    expect(edges.top).toBe("anterior");
    expect(edges.bottom).toBe("posterior");
  });

  test("follows a negative scale on the through-plane axis too", () => {
    const flipped = new Matrix4().scale([1, 1, -1]);
    const { throughPlane } = resolveScreenOrientation(RFC_EXAMPLE, flipped);

    // Ordered by index, which is what the slider moves: with z scaled negatively, the
    // first plane is the inferior one.
    expect(throughPlane.z).toEqual({ from: "inferior", to: "superior" });
  });

  test("a quarter turn moves a label from one edge to the next", () => {
    // Rotating x onto screen y sends the x labels to the top and bottom.
    const rotated = new Matrix4().rotateZ(Math.PI / 2);
    const { edges } = resolveScreenOrientation([space("x", "right-to-left")], rotated);

    expect(edges.left).toBeNull();
    expect(edges.right).toBeNull();
    expect(edges.top).toBe("right");
    expect(edges.bottom).toBe("left");
  });

  test("ignores orientation on a non-spatial axis", () => {
    const axes: Ome.Axis[] = [
      { name: "t", type: "time", orientation: { type: "anatomical", value: "inferior-to-superior" } },
      space("x", "right-to-left"),
    ];
    const { edges, throughPlane } = resolveScreenOrientation(axes, identity());

    expect(edges.left).toBe("right");
    expect(throughPlane).toEqual({});
  });

  test("ignores a value outside the vocabulary rather than drawing nonsense", () => {
    const { edges } = resolveScreenOrientation([space("x", "LPS")], identity());
    expect(edges).toEqual({ left: null, right: null, top: null, bottom: null });
  });

  test("ignores an axis the model matrix has no column for", () => {
    const { edges, throughPlane } = resolveScreenOrientation([space("q", "left-to-right")], identity());
    expect(edges.left).toBeNull();
    expect(throughPlane).toEqual({});
  });

  test("copes with axes or a matrix it was never given", () => {
    expect(resolveScreenOrientation(undefined, identity()).edges).toEqual({
      left: null,
      right: null,
      top: null,
      bottom: null,
    });
    expect(resolveScreenOrientation(RFC_EXAMPLE, undefined).throughPlane).toEqual({});
  });

  test("says when there is nothing to draw", () => {
    expect(hasScreenOrientation(resolveScreenOrientation(RFC_EXAMPLE, identity()))).toBe(true);
    expect(hasScreenOrientation(resolveScreenOrientation([space("x")], identity()))).toBe(false);
    // An image whose only orientation is on the axis we cannot draw.
    expect(hasScreenOrientation(resolveScreenOrientation([space("z", "superior-to-inferior")], identity()))).toBe(
      false,
    );
  });
});
