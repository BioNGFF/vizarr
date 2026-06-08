import { expect, test } from "vitest";
import yaml from 'yaml';
import fs from 'node:fs';
import path from 'node:path';
import expectedColours from './expected_colours.json'

import { getAnndataColors } from "../src/hooks"

const fixtures_path = path.resolve(path.join(__dirname, "..", "..", "fixtures"))

test("Can get anndata colours", async () => {
  const table = yaml.parse(fs.readFileSync(path.join(fixtures_path, "anndata_table.yaml"), 'utf-8'))

  const matrixProps = {
    feature: {
      index: 3
    }
  }
  const colours = await getAnndataColors(table.source, matrixProps)

  expect(colours).toEqual(expectedColours)
})
