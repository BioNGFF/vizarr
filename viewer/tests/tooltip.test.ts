import { expect, test } from "vitest";
import { describeHover, gridCellName } from "../src/components/Viewer";

/** The shape deck.gl hands to getTooltip; only the fields the description reads. */
// biome-ignore lint/suspicious/noExplicitAny: a picking info is wider than this test needs
function hover(fields: Record<string, unknown>): any {
  return { layer: {}, index: 0, ...fields };
}

test("A plate well is named, so the pair of labels is not left to be guessed at", () => {
  const text = describeHover(
    hover({
      gridCoord: { row: 3, column: 6 },
      gridLabels: { row: "D", column: "7" },
      gridCell: { name: "D7" },
    }),
  );
  expect(text).toBe("Well D7");
});

test("An empty plate position says so rather than naming a well that is not there", () => {
  const text = describeHover(
    hover({
      gridCoord: { row: 0, column: 0 },
      gridLabels: { row: "A", column: "1" },
      gridCell: null,
    }),
  );
  expect(text).toBe("Well A1\nNo image");
});

test("A well's grid shows fields, not a row and column run together", () => {
  // A well grid has no row or column labels. This used to concatenate the two indices,
  // so field 1 of row 0 read as "12" -- a number that means nothing.
  const text = describeHover(
    hover({
      gridCoord: { row: 0, column: 1 },
      gridLabels: {},
      gridCell: { name: "1" },
    }),
  );
  expect(text).toBe("Field 1");
});

test("A field keeps the number the grid already draws on it", () => {
  const text = describeHover(hover({ gridCoord: { row: 1, column: 2 }, gridLabels: {}, gridCell: { name: "5" } }));
  expect(text).toBe("Field 5");
});

test("A label pixel names both the segmentation id and the mapped value", () => {
  expect(describeHover(hover({ label: 42, value: 0.73 }))).toBe("Label 42\nValue 0.73");
});

test("A label with nothing mapped onto it shows only the id", () => {
  expect(describeHover(hover({ label: 42, value: null }))).toBe("Label 42");
  expect(describeHover(hover({ label: 42 }))).toBe("Label 42");
});

test("Background, where there is nothing to describe, shows no tooltip", () => {
  expect(describeHover(hover({ label: undefined }))).toBeNull();
  // Label 0 is background in an OME-NGFF label image, not a segment.
  expect(describeHover(hover({ label: 0, value: 1 }))).toBeNull();
  expect(describeHover({ layer: null, index: -1 } as never)).toBeNull();
});

test("A cell's name is the same before the click as the image carries after it", () => {
  // Drilling in uses this to name an image that does not name itself, so the panel
  // header and the tooltip agree rather than one of them reading blank.
  expect(gridCellName(hover({ gridCoord: { row: 1, column: 0 }, gridLabels: { row: "B", column: "1" } }))).toBe(
    "Well B1",
  );
  expect(gridCellName(hover({ gridCoord: { row: 0, column: 0 }, gridLabels: {}, gridCell: { name: "0" } }))).toBe(
    "Field 0",
  );
});

test("Away from the grid there is no cell to name", () => {
  expect(gridCellName(hover({ label: 42 }))).toBeNull();
});
