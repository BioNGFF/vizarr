import { test } from "vitest";
import yaml from 'yaml';
import fs from 'node:fs'
import path from 'node:path'
import { createSourceData } from '../src/io'

test('Resolution-level transformations should be applied', async () => {
  const sourcePath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "resolution_transformationsv0.5.yaml"))
  const source = yaml.parse(fs.readFileSync(sourcePath, 'utf-8'))
  const sourceData = await createSourceData(source)
  console.log(sourceData.model_matrix)
})
