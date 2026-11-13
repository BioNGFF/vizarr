import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { getObservationNames } from "../src/anndata";
import { log } from "../src/logger";
import { startFixtureServer } from "./fixture-server";

/**
 * Reading `obs` from the generated tables in `fixtures/local`, offline.
 *
 * Two tables: one that reads cleanly, and one carrying a categorical column whose
 * categories are missing and a column in a dtype nothing supports. The question they
 * answer is what a column that cannot be read costs -- itself, or every other column.
 *
 * Both failures are deliberately ones no zarrita version papers over. This package
 * declares zarrita 0.5.0, the viewer declares 0.6.2, and the application bundles one
 * copy for both, so a test that turned on a dtype only one of them supports would be
 * asserting something no user could meet.
 */
let origin: string;
let stop: () => Promise<void>;

beforeAll(async () => {
  const server = await startFixtureServer();
  origin = server.url;
  stop = server.close;
});

afterAll(async () => {
  await stop();
});

const observationsFrom = (fixture: string) => getObservationNames(new URL(`${origin}/${fixture}`));

test("A v2 table offers the columns that can be coloured by", async () => {
  const observations = await observationsFrom("table-zarr2.zarr");

  // `cell_type` is free text. It reads without error and is left out anyway, because
  // there is nothing to colour by -- which is not the same as failing, and is why the
  // test below checks that nothing was logged.
  expect(observations.map((observation) => observation.labelIndex)).toEqual(["region", "area", "passed"]);
});

test("A v2 categorical column keeps its categories, and a boolean gets two of its own", async () => {
  const observations = await observationsFrom("table-zarr2.zarr");
  const by = (name: string) => observations.find((observation) => observation.labelIndex === name);

  expect(by("region")?.categories).toEqual(["cortex", "medulla"]);
  expect(by("passed")?.categories).toEqual(["false", "true"]);
  // Numeric, so it gets a colour scale rather than a list.
  expect(by("area")).not.toHaveProperty("categories");
});

test("Nothing is logged for a table that read cleanly", async () => {
  const warn = vi.spyOn(log, "warn").mockImplementation(() => {});
  try {
    await observationsFrom("table-zarr2.zarr");
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});

test("A column that cannot be read costs only itself", async () => {
  const observations = await observationsFrom("table-zarr3.zarr");

  // Previously `[]`. `Promise.all` rejected on the first unreadable column and the
  // outer catch threw away every column that had been read perfectly well -- including
  // these two, which are intact and have nothing to do with the failures.
  expect(observations.map((observation) => observation.labelIndex)).toEqual(["area", "passed"]);
});

test("Each column that could not be read is named in the log", async () => {
  const warn = vi.spyOn(log, "warn").mockImplementation(() => {});
  try {
    await observationsFrom("table-zarr3.zarr");

    // Named, because a column absent from both the panel and the log is
    // indistinguishable from one the table never had.
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining("region"),
      expect.stringContaining("collected"),
    ]);
    // Two different failures, so that neither is the only one the code handles: a node
    // that is not there, and a dtype that is in nobody's table.
    const reasons = warn.mock.calls.map(([, reason]) => (reason as Error).message);
    expect(reasons[1]).toMatch(/data_type: complex64/);
  } finally {
    warn.mockRestore();
  }
});

test("A table that is not there at all yields no observations rather than throwing", async () => {
  // The outer catch still has a job: this is a failure of the table, not of a column.
  expect(await observationsFrom("does-not-exist.zarr")).toEqual([]);
});
