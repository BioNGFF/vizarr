import * as utils from '../src/utils'
import fs from 'fs'
import path from 'path'
import { stringify } from 'yaml';

export async function writeImageYaml(url, imageName, savePath) {
  const node = await utils.open(url)
  const attrs = utils.resolveAttrs(node.attrs)
  const metadata = {
    source: url,
    name: imageName,
    type: attrs.multiscales[0].type,
    version: attrs.version,
    features: {
      multiscale: utils.isMultiscales(attrs)
    }
  }
  fs.writeFileSync(path.join(savePath, `${imageName}.yaml`), stringify(metadata))
}

export function getYamlFileNames(filepath) {
  return fs.readdirSync(filepath).filter((fileName) => fileName.endsWith('.yaml'))
}
