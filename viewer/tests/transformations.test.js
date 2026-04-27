import { expect, test } from "vitest";
import yaml from 'yaml';
import fs from 'node:fs'
import path from 'node:path'
import { createSourceData } from '../src/io'
import { open } from '../src/utils'
import { Scene } from '../src/schemas/0.6/coordinates'

test('Resolution-level transformations should be applied', async () => {
  const sourcePath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "resolution_transformationsv0.5.yaml"))
  const source = yaml.parse(fs.readFileSync(sourcePath, 'utf-8'))
  const sourceData = await createSourceData(source)

  const expectedValues = [0.108335, 0, 0, 0, 0, 0.108335, 0, 0, 0, 0, 0.4, 0, 60.88427, 52.109135, 1.2, 1]

  expect(sourceData.model_matrix.equals(expectedValues))
  console.log(sourceData)
})



test('Image-level transformations should be applied', async () => {
  const sourcePath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "transformationsv0.5.yaml"))
  const source = yaml.parse(fs.readFileSync(sourcePath, 'utf-8'))
  const sourceData = await createSourceData(source)

})

test("Can read a scene image's metadata", async () => {
  const sourcePath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "scene.yaml"))
  const source = yaml.parse(fs.readFileSync(sourcePath, 'utf-8'))
  const sourceData = await createSourceData(source)
})

