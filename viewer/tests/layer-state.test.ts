import { Matrix4 } from "math.gl";
import { describe, expect, test } from "vitest";
import { initLayerStateFromSource } from "../src/io";
import type { SourceData } from "../src/state";

/**
 * Turning a loaded source into the state a layer is drawn from.
 *
 * What this is really guarding is that the two kinds of image are treated alike where
 * they have no business differing. Whether an image arrived as a pyramid or as a single
 * resolution says nothing about whether something is drawn over it.
 */

/** Only `shape` and `labels` are read off a loader here, so only those are given. */
function pixelSource(shape: number[], labels: string[]) {
  return { shape, labels } as unknown as SourceData["loader"][number];
}

function sourceWith({ levels, withLabel }: { levels: number; withLabel: boolean }): SourceData & { id: string } {
  const loader = Array.from({ length: levels }, (_, i) => pixelSource([1, 32 >> i, 32 >> i], ["c", "y", "x"]));
  return {
    id: "source",
    loader,
    axis_labels: ["c", "y", "x"],
    names: ["channel_0"],
    colors: ["FF0000"],
    contrast_limits: [[0, 255]],
    visibilities: [true],
    channel_axis: 0,
    model_matrix: new Matrix4().identity(),
    defaults: { selection: [0, 0, 0], colormap: "", opacity: 1 },
    labels: withLabel
      ? [{ name: "mask", loader: [pixelSource([32, 32], ["y", "x"])], modelMatrix: new Matrix4().identity() }]
      : undefined,
  } as unknown as SourceData & { id: string };
}

describe("initLayerStateFromSource", () => {
  test("keeps the labels of a pyramid", () => {
    const state = initLayerStateFromSource(sourceWith({ levels: 2, withLabel: true }));
    expect(state.kind).toBe("multiscale");
    expect(state.labels).toHaveLength(1);
  });

  test("keeps the labels of a single-resolution image", () => {
    // The case that was being dropped. A SpatialData element is routinely written with
    // one resolution, so its labels loaded correctly and then went nowhere: no error, and
    // no labels section to show for it.
    const state = initLayerStateFromSource(sourceWith({ levels: 1, withLabel: true }));
    expect(state.kind).toBe("image");
    expect(state.labels).toHaveLength(1);
  });

  test.each([
    ["a pyramid", 2],
    ["a single resolution", 1],
  ])("leaves labels undefined for %s with none", (_, levels) => {
    expect(initLayerStateFromSource(sourceWith({ levels, withLabel: false })).labels).toBeUndefined();
  });
});
