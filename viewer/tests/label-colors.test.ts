import { expect, test } from "vitest";
import { applyLabelColors, initLayerStateFromSource, loadSources } from "../src/io";
import type { OmeColor } from "../src/layers/label-layer";
import { range } from "../src/utils";

const labelImageURL = "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr";
const imageURL = "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0066/ExpD_chicken_embryo_MIP.ome.zarr";

function labelColors(count: number): OmeColor[] {
  return range(count).map((id) => ({
    labelValue: id + 1,
    rgba: [id % 256, (id * 3) % 256, (id * 7) % 256, 255] as const,
    value: id / count,
  }));
}

async function loadLayerState(url: string) {
  const [result] = await loadSources([url]);
  expect(result.status).toBe("fulfilled");
  if (result.status !== "fulfilled") {
    throw result.reason;
  }
  return initLayerStateFromSource(result.value);
}

test("Externally-defined label colours are applied to the label layer", async () => {
  const colors = labelColors(61);
  const layerState = await loadLayerState(labelImageURL);

  // Label layers start switched off and uncoloured.
  expect(layerState.labels?.[0].on).toBe(false);

  const next = applyLabelColors(layerState, colors);
  expect(next?.labels?.[0].layerProps.colors).toBe(colors);
  expect(next?.labels?.[0].on).toBe(true);
});

test("Applying label colours does not mutate the original layer state", async () => {
  const layerState = await loadLayerState(labelImageURL);
  const before = layerState.labels?.[0].layerProps.colors;

  applyLabelColors(layerState, labelColors(61));

  expect(layerState.labels?.[0].layerProps.colors).toBe(before);
  expect(layerState.labels?.[0].on).toBe(false);
});

test("Label colours cannot be applied to an image with no label", async () => {
  const layerState = await loadLayerState(imageURL);
  expect(layerState.labels).toBeUndefined();
  // Signals to the caller that a user-facing error should be raised.
  expect(applyLabelColors(layerState, labelColors(61))).toBeNull();
});

test("Loading a source that does not exist is reported as rejected", async () => {
  const results = await loadSources(["https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/does-not-exist.zarr"]);
  expect(results[0].status).toBe("rejected");
});
