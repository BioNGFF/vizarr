import { test } from "vitest";
import { createSourceData } from "../src/io";
import { getYamlFileNames, writeImageYaml } from './metadata'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

const imagesPath = path.resolve(path.join(__dirname, '..', '..', 'fixtures'))

const files = getYamlFileNames(imagesPath)

files.map(async (file) => {
  const filePath = path.join(imagesPath, file)
  const description = yaml.parse(fs.readFileSync(filePath, 'utf8'))
  test(`Can read ${description.name} without error`, async () => {
    await createSourceData(
      {
        source: description.source
      }
    )
    await writeImageYaml(description.source, description.name, imagesPath)
  })
})
