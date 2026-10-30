import { expect, test } from "vitest";
import { decodeNavigationStep, encodeNavigationStep } from "../src/state";

const PLATE = "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0001A/2551.zarr";

test("A step the url fully describes is just its url, so a plain trail stays readable", () => {
  expect(encodeNavigationStep({ source: PLATE, name: "2551" })).toBe(PLATE);
});

test("An acquisition rides along, so stepping back restores the view that was left", () => {
  const encoded = encodeNavigationStep({ source: PLATE, name: "2551", acquisition: "2653" });
  expect(encoded).toBe(`${PLATE}#acquisition=2653`);
  expect(decodeNavigationStep(encoded)).toMatchObject({ source: PLATE, acquisition: "2653" });
});

test("A name the url cannot give is carried, so a refresh reads as the session did", () => {
  // A plate is called whatever its metadata calls it; the url only knows it as 2551.
  const encoded = encodeNavigationStep({ source: PLATE, name: "JL_120731_S6A" });
  expect(decodeNavigationStep(encoded).name).toBe("JL_120731_S6A");
  // Round-tripped through a real parameter, since the name may need escaping.
  const viaUrl = new URLSearchParams(`from=${encodeURIComponent(encoded)}`);
  expect(decodeNavigationStep(viaUrl.get("from") as string).name).toBe("JL_120731_S6A");
});

test("A name the url already gives is not repeated into it", () => {
  // Keeps the common case short: a well is named the same either way.
  expect(encodeNavigationStep({ source: `${PLATE}/A/1`, name: "Well A1" })).toBe(`${PLATE}/A/1`);
});

test("A step survives the round trip through a URL parameter", () => {
  const step = { source: `${PLATE}/A/1`, name: "Well A1", acquisition: "2661" };

  const viaUrl = new URLSearchParams(`from=${encodeURIComponent(encodeNavigationStep(step))}`);
  const decoded = decodeNavigationStep(viaUrl.get("from") as string);
  expect(decoded.source).toBe(step.source);
  expect(decoded.acquisition).toBe(step.acquisition);
});

test("A trail written by hand is named from the path, in the words used elsewhere", () => {
  // The same words the panel and the tooltip use, so the two never disagree.
  expect(decodeNavigationStep(`${PLATE}/A/1`).name).toBe("Well A1");
  expect(decodeNavigationStep(`${PLATE}/D/12`).name).toBe("Well D12");
  expect(decodeNavigationStep(`${PLATE}/A/1/0`).name).toBe("Field 0");
  // A plate is named by its group, without the extension repeated back at the reader.
  expect(decodeNavigationStep(PLATE).name).toBe("2551");
  expect(decodeNavigationStep("https://example.com/x/KP_PCNSL.ome.zarr").name).toBe("KP_PCNSL");
});

test("A trailing slash does not change what a step is called", () => {
  expect(decodeNavigationStep(`${PLATE}/A/1/`).name).toBe("Well A1");
});

test("A step with an empty acquisition is treated as having none", () => {
  expect(decodeNavigationStep(`${PLATE}#acquisition=`).acquisition).toBeUndefined();
});
