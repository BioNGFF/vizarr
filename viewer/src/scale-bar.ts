/**
 * @module
 * The unit a scale bar can be measured in.
 *
 * NGFF spells units as UDUNITS-2 names -- `micrometer`, not `um` -- and viv's scale bar
 * measures in SI symbols. The difference is not cosmetic. Given a name, viv's
 * `sizeToMeters` throws, so the bar can only be drawn unsnapped, and an unsnapped bar is
 * a fixed 5% of the viewport labelled to five significant figures: a correct number that
 * no one can lay against the image by eye.
 *
 * Nothing here trusts viv to reject what it cannot measure. Its prefix test takes every
 * character but the last and never checks that the last one is `m`, so `ft` reads as
 * femto-something. What we pass has to be a length we have already decided is metric.
 */

/**
 * SI prefixes, by the UDUNITS-2 name NGFF writes and the symbol viv measures with.
 *
 * Taken from `SI_PREFIXES` in `@vivjs/layers@0.17.2`. `micro` is the one to be careful
 * with: that table holds U+00B5 MICRO SIGN, so a Greek mu has to be turned into it
 * rather than passed along.
 */
const PREFIXES: ReadonlyArray<readonly [name: string, symbol: string]> = [
  ["yotta", "Y"],
  ["zetta", "Z"],
  ["exa", "E"],
  ["peta", "P"],
  ["tera", "T"],
  ["giga", "G"],
  ["mega", "M"],
  ["kilo", "k"],
  ["hecto", "h"],
  ["deca", "da"],
  ["deci", "d"],
  ["centi", "c"],
  ["milli", "m"],
  ["micro", "µ"],
  ["nano", "n"],
  ["pico", "p"],
  ["femto", "f"],
  ["atto", "a"],
  ["zepto", "z"],
  ["yocto", "y"],
];

/**
 * Symbols, matched as written. `Mm` is a megametre and `mm` a millimetre, so this is the
 * one lookup that cannot be case-folded.
 */
const SYMBOLS = new Map<string, string>([
  ["m", "m"],
  // Both spellings of micro, and the ASCII `u` writers reach for, land on viv's.
  ["µm", "µm"],
  ["μm", "µm"],
  ["um", "µm"],
]);

/** Names, matched after case folding, since `Micrometer` is the same unit as `micrometer`. */
const NAMES = new Map<string, string>([
  ["meter", "m"],
  ["metre", "m"],
]);

for (const [name, symbol] of PREFIXES) {
  SYMBOLS.set(`${symbol}m`, `${symbol}m`);
  NAMES.set(`${name}meter`, `${symbol}m`);
  NAMES.set(`${name}metre`, `${symbol}m`);
}

/**
 * The symbol viv should measure in, or `undefined` for no scale bar at all.
 *
 * `undefined` covers three cases, and they all deserve the same answer. A unit that is
 * absent, because viv reads an empty unit as metres and would put a confident bar in
 * metres over an image measured in microns. A unit that is not a length -- whatever a
 * writer may have put there. And a length that is not metric: `foot`, `inch`, `mile`,
 * `yard`, `parsec`, and `angstrom`, which is 10^-10 and so has no SI prefix to carry it.
 * Drawing nothing is the honest reading of all three.
 */
export function scaleBarUnit(unit: string | undefined | null): string | undefined {
  if (!unit) {
    return undefined;
  }
  const trimmed = unit.trim();
  return SYMBOLS.get(trimmed) ?? NAMES.get(trimmed.toLowerCase());
}
