import { describe, expect, test } from "vitest";
import { createSourceData } from "../../src/io";
import { openZarrRoot } from "../../src/services/http";

/**
 * The RFC-4 axis orientation conformance corpus.
 *
 * RFC-4 adds an `orientation` to spatial axes saying which anatomical direction the
 * axis runs in, from its lowest coordinate to its highest. The reference implementation
 * publishes a corpus of images carrying it, which is what these tests read:
 * https://github.com/fideus-labs/ome-zarr-rfc4-validation
 *
 * Remote because it is someone else's server. The images are small -- the largest here
 * is 132 x 80 x 114 -- but filebase.io going down must not fail a pull request, which is
 * what `tests/remote` is for.
 *
 * Every case has a `_flip` twin carrying the reversed term on each axis. The pixels are
 * the same and only the metadata differs, so the pair is what catches an implementation
 * that reads orientation but puts it on the wrong end of the axis.
 *
 * Written as NGFF 0.5 (zarr v3), which is the only form the corpus publishes.
 */
const CORPUS = "https://ome-zarr-rfc4.s3.filebase.io/ome-zarr";

interface Case {
  name: string;
  /** Axis names, in the order the metadata declares them. */
  axes: string[];
  /** The orientation of each axis, `null` where the corpus leaves one unannotated. */
  orientations: (string | null)[];
  /** The unit every spatial axis declares, or `null` where the case declares none. */
  unit: string | null;
}

/**
 * The 16 valid OME-Zarr cases, which between them use all 24 terms of the controlled
 * vocabulary. Transcribed from the corpus manifest; `manifest.csv` at the bucket root
 * is the source of truth if these ever need rebuilding.
 */
const CASES: Case[] = [
  {
    name: "airway_epithelium",
    axes: ["z", "y", "x"],
    orientations: ["apical-to-basal", null, null],
    unit: "nanometer",
  },
  {
    name: "airway_epithelium_flip",
    axes: ["z", "y", "x"],
    orientations: ["basal-to-apical", null, null],
    unit: "nanometer",
  },
  {
    name: "brain_icbm_ras",
    axes: ["z", "y", "x"],
    orientations: ["inferior-to-superior", "posterior-to-anterior", "left-to-right"],
    unit: null,
  },
  {
    name: "brain_icbm_ras_flip",
    axes: ["z", "y", "x"],
    orientations: ["superior-to-inferior", "anterior-to-posterior", "right-to-left"],
    unit: null,
  },
  {
    name: "foot_cmb_limb",
    axes: ["z", "y", "x"],
    orientations: ["distal-to-proximal", "dorsal-to-plantar", null],
    unit: null,
  },
  {
    name: "foot_cmb_limb_flip",
    axes: ["z", "y", "x"],
    orientations: ["proximal-to-distal", "plantar-to-dorsal", null],
    unit: null,
  },
  {
    name: "heart_sunnybrook_apex_base",
    axes: ["z", "y", "x"],
    orientations: ["apex-to-base", null, null],
    unit: "millimeter",
  },
  {
    name: "heart_sunnybrook_flip",
    axes: ["z", "y", "x"],
    orientations: ["base-to-apex", null, null],
    unit: "millimeter",
  },
  {
    name: "mouse_allen_quadruped",
    axes: ["z", "y", "x"],
    orientations: ["rostral-to-caudal", "dorsal-to-ventral", "right-to-left"],
    unit: null,
  },
  {
    name: "mouse_allen_quadruped_flip",
    axes: ["z", "y", "x"],
    orientations: ["caudal-to-rostral", "ventral-to-dorsal", "left-to-right"],
    unit: null,
  },
  {
    name: "mouse_rosenhain_wholebody",
    axes: ["z", "y", "x"],
    orientations: ["caudal-to-cranial", "dorsal-to-ventral", null],
    unit: "micrometer",
  },
  {
    name: "mouse_rosenhain_flip",
    axes: ["z", "y", "x"],
    orientations: ["cranial-to-caudal", "dorsal-to-ventral", null],
    unit: "micrometer",
  },
  {
    name: "skin_janelia_superficial_deep",
    axes: ["z", "y", "x"],
    orientations: ["superficial-to-deep", null, null],
    unit: "micrometer",
  },
  {
    name: "skin_janelia_flip",
    axes: ["z", "y", "x"],
    orientations: ["deep-to-superficial", null, null],
    unit: "micrometer",
  },
  {
    name: "vocab-quad-limb",
    axes: ["z", "y", "x"],
    orientations: ["cranial-to-caudal", "dorsal-to-palmar", "proximal-to-distal"],
    unit: null,
  },
  {
    name: "vocab-quad-limb-flip",
    axes: ["z", "y", "x"],
    orientations: ["caudal-to-cranial", "palmar-to-dorsal", "distal-to-proximal"],
    unit: null,
  },
];

/** The axes a case declares, read from the store rather than through the viewer. */
async function declaredAxes(name: string) {
  const node = await openZarrRoot(`${CORPUS}/${name}.ome.zarr`);
  const attrs = node.attrs as {
    ome: { multiscales: { axes: { name: string; unit?: string; orientation?: { type: string; value: string } }[] }[] };
  };
  return attrs.ome.multiscales[0].axes;
}

/**
 * Each case and its flipped twin. Named rather than derived: three of the originals do
 * not share a stem with their twin (`skin_janelia_superficial_deep` flips to
 * `skin_janelia_flip`), and guessing produced a test that looked like it compared them
 * and in fact only 404'd.
 */
const PAIRS: [original: string, flipped: string][] = [
  ["airway_epithelium", "airway_epithelium_flip"],
  ["brain_icbm_ras", "brain_icbm_ras_flip"],
  ["foot_cmb_limb", "foot_cmb_limb_flip"],
  ["heart_sunnybrook_apex_base", "heart_sunnybrook_flip"],
  ["mouse_allen_quadruped", "mouse_allen_quadruped_flip"],
  ["mouse_rosenhain_wholebody", "mouse_rosenhain_flip"],
  ["skin_janelia_superficial_deep", "skin_janelia_flip"],
  ["vocab-quad-limb", "vocab-quad-limb-flip"],
];

const byName = (name: string) => {
  const match = CASES.find((entry) => entry.name === name);
  if (!match) throw new Error(`No case named ${name}`);
  return match;
};

describe.each(CASES)("$name", ({ name, axes, orientations, unit }) => {
  test("can be read by the viewer", async () => {
    const sourceData = await createSourceData({ source: `${CORPUS}/${name}.ome.zarr` });

    expect(sourceData).toHaveLength(1);
    expect(sourceData[0].axis_labels).toEqual(axes);
    expect(sourceData[0].loader[0].shape).toHaveLength(axes.length);

    // The orientation reaches the viewer, rather than being stripped on the way in by
    // a schema or an axis rebuilt from the three fields someone happened to name.
    expect(sourceData[0].axes?.map((axis) => axis.orientation?.value ?? null)).toEqual(orientations);
    for (const axis of sourceData[0].axes ?? []) {
      if (axis.orientation) {
        expect(axis.orientation.type).toBe("anatomical");
      }
    }

    // Only where the case declares one: an axis with no unit is not a bug, and the
    // viewer reports "" for it.
    if (unit !== null) {
      const physicalSizes = sourceData[0].loader[0].meta?.physicalSizes;
      expect(physicalSizes?.x?.unit).toBe(unit);
      expect(physicalSizes?.y?.unit).toBe(unit);
    }
  });

  // A guard on the corpus, not on the viewer: it is a third party's data, and every
  // assertion above is worthless if it changes underneath us without anyone noticing.
  test("still declares the orientation recorded here", async () => {
    const declared = await declaredAxes(name);
    const expected = byName(name);

    expect(declared.map((axis) => axis.name)).toEqual(expected.axes);
    expect(declared.map((axis) => axis.orientation?.value ?? null)).toEqual(expected.orientations);
    for (const axis of declared) {
      if (axis.orientation) {
        expect(axis.orientation.type).toBe("anatomical");
      }
    }
  });
});

/**
 * The twins carry a reversed term over identical pixels, so they are what catches a
 * reader that finds the orientation but labels the wrong end of the axis.
 *
 * Not every axis reverses. `mouse_rosenhain_flip` reverses z and leaves y as
 * `dorsal-to-ventral`, because the corpus built it to cover `cranial-to-caudal` in real
 * data rather than to be a whole-image mirror. So the invariant is per axis: each one is
 * either unannotated in both, unchanged, or the exact reverse -- never some third term.
 *
 * Checked against the table rather than the network, since the test above has already
 * established that the table is what the corpus serves.
 */
describe.each(PAIRS)("%s flips to %s", (original, flipped) => {
  test("reverses at least one axis, and changes no axis to an unrelated term", () => {
    const before = byName(original);
    const after = byName(flipped);

    expect(after.axes).toEqual(before.axes);
    expect(after.orientations).toHaveLength(before.orientations.length);

    let reversed = 0;
    for (const [i, was] of before.orientations.entries()) {
      const now = after.orientations[i];
      if (was === null) {
        expect(now).toBeNull();
        continue;
      }
      const [from, to] = was.split("-to-");
      expect(now).toBeOneOf([was, `${to}-to-${from}`]);
      if (now !== was) {
        reversed += 1;
      }
    }
    expect(reversed).toBeGreaterThan(0);
  });
});

/**
 * The corpus also ships must-reject cases. TC-D puts an orientation on a time axis,
 * which RFC-4 forbids: "The `orientation` field MUST only be used on spatial axes".
 *
 * The viewer still opens it, and should. Refusing a whole image over one misplaced
 * annotation is the opposite of what `parse` is for -- see the note in `parsers/parse.ts`
 * about warning rather than erroring. This is the case that Phase 2 of #158 warns on.
 *
 * The corpus's other must-reject case, TC-C, carries a value outside the controlled
 * vocabulary. It is deliberately left untested here while #158 settles whether an
 * unreadable orientation should cost the reader the whole image.
 */
describe("must-reject cases", () => {
  test("an orientation on a time axis does not stop the image loading", async () => {
    const sourceData = await createSourceData({
      source: `${CORPUS}/TC-D_orientation_on_time_axis.ome.zarr`,
    });

    expect(sourceData[0].axis_labels).toEqual(["t", "z", "y", "x"]);

    const declared = await declaredAxes("TC-D_orientation_on_time_axis");
    const time = declared.find((axis) => axis.name === "t");
    expect(time?.orientation?.value).toBe("inferior-to-superior");

    // It reaches the viewer too. Nothing in the reader drops it, which is what lets the
    // interface warn about it rather than the image simply looking unremarkable.
    const read = sourceData[0].axes?.find((axis) => axis.name === "t");
    expect(read?.orientation?.value).toBe("inferior-to-superior");
  });
});
