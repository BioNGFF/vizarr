import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import yaml from "yaml";
import expectedColours from "./expected_colours.json";

import { getAnndataColors } from "../src/hooks";

const fixtures_path = path.resolve(path.join(__dirname, "..", "..", "fixtures"));

test("Can get anndata colours", async () => {
  const table = yaml.parse(fs.readFileSync(path.join(fixtures_path, "anndata_table.yaml"), "utf-8"));

  const colours = await getAnndataColors(table.source, { type: "feature", labelIndex: "3" });

  expect(colours).toEqual(expectedColours);
});
