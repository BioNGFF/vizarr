/**
 * Writes the small OME-Zarr images that the offline tests read.
 *
 * These are built rather than downloaded so the default test suite needs no network:
 * a real server can go down, change its data, or simply be slow, none of which should
 * turn a pull request red. The output is committed, so a test reads a fixed artefact
 * rather than whatever this script happens to produce today; re-run it only when the
 * fixtures need to change, and commit the result.
 *
 *   node scripts/make-local-fixtures.mjs
 *
 * Written by hand rather than through zarrita, so that the fixtures are evidence
 * independent of the library under test. A bug in zarrita's writer would otherwise
 * produce a file its reader is happy with and nobody else is.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "fixtures", "local");

/** Axis order every fixture uses, which is the order OME-NGFF requires. */
const AXES = [
  { name: "t", type: "time" },
  { name: "c", type: "channel" },
  { name: "z", type: "space" },
  { name: "y", type: "space", unit: "micrometer" },
  { name: "x", type: "space", unit: "micrometer" },
];

const CHANNEL_COLORS = ["FF0000", "00FF00"];
const CHANNEL_LABELS = ["Red channel", "Green channel"];

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * A gradient, so that no channel is flat. A flat channel would make calcDataRange
 * return its [0, 1] fallback and the contrast limits would stop telling us anything.
 */
function pixels({ channels, height, width }) {
  const planes = [];
  for (let c = 0; c < channels; c++) {
    const plane = new Uint8Array(height * width);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        plane[y * width + x] = (x * 4 + y * 2 + c * 61) % 256;
      }
    }
    planes.push(plane);
  }
  return planes;
}

/** The `multiscales` entry shared by both zarr versions; only `version` differs. */
function multiscales({ levels, version, name }) {
  return [
    {
      name,
      version,
      axes: AXES,
      datasets: levels.map((level, index) => ({
        path: String(index),
        coordinateTransformations: [{ type: "scale", scale: [1, 1, 1, 2 ** index, 2 ** index] }],
      })),
    },
  ];
}

function omero({ channels, name, version }) {
  return {
    version,
    name,
    channels: Array.from({ length: channels }, (_, c) => ({
      label: CHANNEL_LABELS[c],
      color: CHANNEL_COLORS[c],
      active: true,
      window: { start: 0, end: 255, min: 0, max: 255 },
    })),
  };
}

/** Halving each step, as a pyramid conventionally does. */
function levelsFor({ size, depth }) {
  return Array.from({ length: depth }, (_, index) => size / 2 ** index);
}

// ---------------------------------------------------------------------------
// zarr v2, which OME-NGFF 0.4 and earlier are written in.
// ---------------------------------------------------------------------------

/**
 * One resolution level. Uncompressed and chunked whole: a fixture is read far more
 * often by a person wondering what it contains than by a test, and raw little-endian
 * bytes can be read with `xxd`.
 */
function writeArrayV2(dir, { channels, height, width }) {
  writeJson(path.join(dir, ".zarray"), {
    zarr_format: 2,
    shape: [1, channels, 1, height, width],
    chunks: [1, 1, 1, height, width],
    dtype: "|u1",
    compressor: null,
    fill_value: 0,
    order: "C",
    filters: null,
    dimension_separator: "/",
  });
  pixels({ channels, height, width }).forEach((plane, c) => {
    write(path.join(dir, "0", String(c), "0", "0", "0"), Buffer.from(plane));
  });
}

function writeImageV2(dir, { name, channels = 2, size = 32, depth = 2, version = "0.4" }) {
  const levels = levelsFor({ size, depth });
  writeJson(path.join(dir, ".zgroup"), { zarr_format: 2 });
  writeJson(path.join(dir, ".zattrs"), {
    multiscales: multiscales({ levels, version, name }),
    omero: omero({ channels, name, version }),
  });
  levels.forEach((edge, index) => {
    writeArrayV2(path.join(dir, String(index)), { channels, height: edge, width: edge });
  });
}

// ---------------------------------------------------------------------------
// zarr v3, which OME-NGFF 0.5 is written in.
// ---------------------------------------------------------------------------

function writeArrayV3(dir, { channels, height, width }) {
  writeJson(path.join(dir, "zarr.json"), {
    zarr_format: 3,
    node_type: "array",
    shape: [1, channels, 1, height, width],
    data_type: "uint8",
    chunk_grid: { name: "regular", configuration: { chunk_shape: [1, 1, 1, height, width] } },
    chunk_key_encoding: { name: "default", configuration: { separator: "/" } },
    fill_value: 0,
    codecs: [{ name: "bytes", configuration: { endian: "little" } }],
    attributes: {},
  });
  pixels({ channels, height, width }).forEach((plane, c) => {
    write(path.join(dir, "c", "0", String(c), "0", "0", "0"), Buffer.from(plane));
  });
}

function writeImageV3(dir, { name, channels = 2, size = 32, depth = 2 }) {
  const levels = levelsFor({ size, depth });
  // 0.5 moved the version to the `ome` key and dropped it from the blocks beneath.
  const scales = multiscales({ levels, version: undefined, name });
  for (const entry of scales) {
    entry.version = undefined;
  }
  writeJson(path.join(dir, "zarr.json"), {
    zarr_format: 3,
    node_type: "group",
    attributes: {
      ome: {
        version: "0.5",
        multiscales: scales.map(({ version, ...rest }) => rest),
        omero: (({ version, ...rest }) => rest)(omero({ channels, name, version: "0.5" })),
      },
    },
  });
  levels.forEach((edge, index) => {
    writeArrayV3(path.join(dir, String(index)), { channels, height: edge, width: edge });
  });
}

// ---------------------------------------------------------------------------
// A plate, which is the path that costs the most to test against a real server:
// one plate fixture in the corpus describes 3,457 remote nodes.
// ---------------------------------------------------------------------------

/**
 * Deliberately sparse, and deliberately uneven. Real plates leave wells empty and
 * image some wells more than once, and both are easy to get wrong in a way no
 * fully-populated fixture would catch. B/2 is unimaged; A/1 holds two acquisitions.
 */
const PLATE_WELLS = [
  {
    path: "A/1",
    rowIndex: 0,
    columnIndex: 0,
    images: [
      { path: "0", acquisition: 1 },
      { path: "1", acquisition: 2 },
    ],
  },
  { path: "A/2", rowIndex: 0, columnIndex: 1, images: [{ path: "0", acquisition: 1 }] },
  { path: "B/1", rowIndex: 1, columnIndex: 0, images: [{ path: "0", acquisition: 2 }] },
];

function writePlateV2(dir, { name, version = "0.4", size = 16, depth = 2 }) {
  writeJson(path.join(dir, ".zgroup"), { zarr_format: 2 });
  writeJson(path.join(dir, ".zattrs"), {
    plate: {
      version,
      name,
      columns: [{ name: "1" }, { name: "2" }],
      rows: [{ name: "A" }, { name: "B" }],
      wells: PLATE_WELLS.map(({ path, rowIndex, columnIndex }) => ({ path, rowIndex, columnIndex })),
      // Two of them, so the acquisition chooser has a real choice to offer. Named out
      // of time order on purpose: the chooser sorts by starttime, and a fixture that
      // is already sorted cannot show whether it does.
      // Ids start at 1, as IDR's do. An id of 0 is legal and currently mishandled
      // (issue #136); changing one of these to 0 reproduces that without a network.
      acquisitions: [
        { id: 1, name: "Second pass", starttime: 2000 },
        { id: 2, name: "First pass", starttime: 1000 },
      ],
      field_count: 2,
    },
  });

  for (const well of PLATE_WELLS) {
    const wellDir = path.join(dir, ...well.path.split("/"));
    writeJson(path.join(wellDir, ".zgroup"), { zarr_format: 2 });
    writeJson(path.join(wellDir, ".zattrs"), {
      well: { version, images: well.images },
    });
    for (const image of well.images) {
      writeImageV2(path.join(wellDir, image.path), {
        name: `${well.path} field ${image.path}`,
        channels: 1,
        size,
        depth,
        version,
      });
    }
  }
}

// ---------------------------------------------------------------------------

const fixtures = [
  ["image-v04.zarr", (dir) => writeImageV2(dir, { name: "Local image v0.4" })],
  ["image-v05.zarr", (dir) => writeImageV3(dir, { name: "Local image v0.5" })],
  ["plate-v04.zarr", (dir) => writePlateV2(dir, { name: "Local plate v0.4" })],
];

for (const [name, build] of fixtures) {
  const dir = path.join(root, name);
  fs.rmSync(dir, { recursive: true, force: true });
  build(dir);
  let files = 0;
  let bytes = 0;
  const walk = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        files += 1;
        bytes += fs.statSync(full).size;
      }
    }
  };
  walk(dir);
  console.log(`${name.padEnd(16)} ${String(files).padStart(4)} files  ${(bytes / 1024).toFixed(1).padStart(7)} KiB`);
}
