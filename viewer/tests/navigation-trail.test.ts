import { expect, test } from "vitest";
import { decodeNavigationStep, encodeNavigationStep } from "../src/state";

const PLATE = "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0001A/2551.zarr";

test("A step with no acquisition is just its url, so a plain trail stays readable", () => {
  expect(encodeNavigationStep({ source: PLATE, name: "JL_120731_S6A" })).toBe(PLATE);
});

test("An acquisition rides along, so stepping back restores the view that was left", () => {
  const encoded = encodeNavigationStep({ source: PLATE, name: "JL_120731_S6A", acquisition: "2653" });
  expect(encoded).toBe(`${PLATE}#acquisition=2653`);
  expect(decodeNavigationStep(encoded)).toMatchObject({ source: PLATE, acquisition: "2653" });
});

test("A step survives the round trip through a URL parameter", () => {
  const step = { source: `${PLATE}/A/1`, name: "Well A1", acquisition: "2661" };
  const viaUrl = new URLSearchParams(`from=${encodeURIComponent(encodeNavigationStep(step))}`);
  const decoded = decodeNavigationStep(viaUrl.get("from") as string);
  expect(decoded.source).toBe(step.source);
  expect(decoded.acquisition).toBe(step.acquisition);
});

test("A trail arriving from a URL is named from the path, since nothing has loaded it", () => {
  // A well is addressed as <plate>/<row>/<column>, which reads as the well's own name.
  expect(decodeNavigationStep(`${PLATE}/A/1`).name).toBe("A1");
  expect(decodeNavigationStep(`${PLATE}/D/12`).name).toBe("D12");
  // A plate is named by its group, without the extension repeated back at the reader.
  expect(decodeNavigationStep(PLATE).name).toBe("2551");
  expect(decodeNavigationStep("https://example.com/x/KP_PCNSL.ome.zarr").name).toBe("KP_PCNSL");
});

test("A field inside a well is not mistaken for a well", () => {
  // <plate>/A/1/0 ends in two digits, so the row/column rule must not fire.
  expect(decodeNavigationStep(`${PLATE}/A/1/0`).name).toBe("0");
});

test("A trailing slash does not change what a step is called", () => {
  expect(decodeNavigationStep(`${PLATE}/A/1/`).name).toBe("A1");
});

test("A step with an empty acquisition is treated as having none", () => {
  expect(decodeNavigationStep(`${PLATE}#acquisition=`).acquisition).toBeUndefined();
});
