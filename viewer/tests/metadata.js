import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import * as utils from "../src/utils";

export async function writeImageYaml(url, imageName, savePath) {
  const node = await utils.open(url);
  const attrs = utils.resolveAttrs(node.attrs);
  const metadata = {
    source: url,
    name: imageName,
    features: {
      multiscale: utils.isMultiscales(attrs),
    },
  };
  fs.writeFileSync(path.join(savePath, `${imageName}.yaml`), stringify(metadata));
}

export function getYamlFileNames(filepath) {
  return fs.readdirSync(filepath).filter((fileName) => fileName.endsWith(".yaml"));
}
