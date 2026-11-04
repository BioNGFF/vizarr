import { ScaleBarLayer } from "@hms-dbmi/viv";
import { describe, expect, test } from "vitest";
import { scaleBarUnit } from "../src/scale-bar";

/**
 * The scale bar's unit, and what viv does with it.
 *
 * Offline, but not only arithmetic: the second half drives viv's own `ScaleBarLayer` and
 * reads the label it renders. That is the part worth having. The mapping is a claim
 * about what another library accepts, and the only way to be sure of such a claim is to
 * hand it the value and look at what comes back -- which is also how the bug this fixes
 * was found, after `snap: true` on its own was measured and seen to throw.
 */

/** The label and bar length viv renders for a unit, at a given zoom. */
function render(unit: string, snap: boolean, { size = 0.5, zoom = 0 } = {}) {
  const viewState = { target: [0, 0, 0], zoom, width: 800, height: 600 };
  const subLayers = new ScaleBarLayer({ id: "test", size, unit, viewState, snap }).renderLayers() as Array<{
    id: string;
    props: { data: unknown };
  }>;
  const label = subLayers.find((layer) => layer.id.startsWith("units-label"));
  const line = subLayers.find((layer) => layer.id.startsWith("scale-bar-length"));
  const [[start, end]] = line?.props.data as [[number[], number[]]];
  return { text: (label?.props.data as Array<{ text: string }>)[0].text, length: end[0] - start[0] };
}

describe("scaleBarUnit", () => {
  test.each([
    ["micrometer", "µm"],
    ["nanometer", "nm"],
    ["millimeter", "mm"],
    ["centimeter", "cm"],
    ["meter", "m"],
    ["kilometer", "km"],
    ["decameter", "dam"],
  ])("maps the UDUNITS name %s, which is how NGFF spells it", (unit, expected) => {
    expect(scaleBarUnit(unit)).toBe(expected);
  });

  test.each([
    ["metre", "m"],
    ["micrometre", "µm"],
    ["Micrometer", "µm"],
    ["  micrometer  ", "µm"],
  ])("accepts %s as the same unit", (unit, expected) => {
    expect(scaleBarUnit(unit)).toBe(expected);
  });

  test.each([
    ["µm", "µm"],
    ["nm", "nm"],
    ["m", "m"],
  ])("passes a symbol %s through, for metadata that already uses one", (unit, expected) => {
    expect(scaleBarUnit(unit)).toBe(expected);
  });

  test.each([
    ["the Greek mu, which viv's table does not hold", "μm"],
    ["the ASCII u writers reach for", "um"],
  ])("turns %s into the micro sign", (_, unit) => {
    expect(scaleBarUnit(unit)).toBe("µm");
  });

  test("tells a megametre from a millimetre", () => {
    // The one lookup that cannot be case-folded: these differ by case alone, and by nine
    // orders of magnitude.
    expect(scaleBarUnit("Mm")).toBe("Mm");
    expect(scaleBarUnit("mm")).toBe("mm");
  });

  test.each([
    ["nothing at all", ""],
    ["undefined", undefined],
    ["null", null],
    ["a length that is not metric", "foot"],
    ["another", "inch"],
    ["an angstrom, which is 10^-10 and has no SI prefix", "angstrom"],
    ["a unit of distance no bar could carry", "parsec"],
    ["something that is not a length", "banana"],
  ])("draws no bar for %s", (_, unit) => {
    expect(scaleBarUnit(unit)).toBeUndefined();
  });

  test("refuses ft, which viv itself would read as femtometres", () => {
    // viv's prefix test is `unit.substring(0, unit.length - 1)` and never checks that
    // what remains is `m`, so `ft` parses as `f` and renders femtometres. Measured:
    expect(render("ft", true).text).toBe("25fm");
    // Which is why nothing here trusts viv to reject what it cannot measure.
    expect(scaleBarUnit("ft")).toBeUndefined();
  });
});

describe("what viv renders for the unit it is given", () => {
  test("throws on the name NGFF writes, which is why the mapping exists", () => {
    expect(() => render("micrometer", true)).toThrow("Received unknown unit");
  });

  test("draws every symbol the mapping can return without throwing", () => {
    const units = [
      "angstrom",
      "nanometer",
      "micrometer",
      "millimeter",
      "centimeter",
      "meter",
      "kilometer",
      "foot",
      "inch",
      "yard",
      "mile",
      "parsec",
      "decameter",
      "hectometer",
      "megameter",
      "picometer",
      "femtometer",
      "attometer",
      "decimeter",
      "exameter",
      "gigameter",
      "terameter",
      "petameter",
      "yoctometer",
      "yottameter",
      "zeptometer",
      "zettameter",
    ];
    // The full NGFF 0.4 list of space units. Each one either maps to something viv draws,
    // or maps to nothing -- never to something that throws mid-render.
    for (const unit of units) {
      const symbol = scaleBarUnit(unit);
      if (symbol) {
        expect(() => render(symbol, true)).not.toThrow();
      }
    }
    expect(units.filter((unit) => scaleBarUnit(unit) === undefined)).toEqual([
      "angstrom",
      "foot",
      "inch",
      "yard",
      "mile",
      "parsec",
    ]);
  });

  test("snapping is what makes the number readable", () => {
    // Unsnapped, the bar is a fixed 5% of the viewport and the label is whatever that
    // measures, to five significant figures. Snapped, the bar moves to a round length.
    expect(render("µm", false)).toEqual({ text: "20.000µm", length: 40 });
    expect(render("µm", true)).toEqual({ text: "25µm", length: 50 });
  });

  test("and it keeps the number round as the view zooms", () => {
    expect(render("µm", false, { zoom: 2 }).text).toBe("5.0000µm");
    expect(render("µm", true, { zoom: 2 }).text).toBe("10µm");
  });

  test("would put a bar in metres over an image that declares no unit", () => {
    // Half a micrometre per pixel, read as half a metre per pixel. This is the bar that
    // is not drawn at all now, and the reason an absent unit is not treated as a default.
    expect(render("", true).text).toBe("25m");
  });
});
