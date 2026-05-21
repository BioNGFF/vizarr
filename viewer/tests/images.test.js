import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";
import yaml from "yaml";
import { createSourceData } from "../src/io";
import { getYamlFileNames, writeImageYaml, writeUntestableYaml } from "./metadata";

const imagesPath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "generic"));

const files = getYamlFileNames(imagesPath);

files.map(async (file) => {
  const filePath = path.join(imagesPath, file);
  const description = yaml.parse(fs.readFileSync(filePath, "utf8"));

  if (description.testable) {
    test(`Can read ${description.name} without error`, async () => {
      await createSourceData({
        source: description.source,
      });
      await writeImageYaml(description.source, description.name, imagesPath);
    }, 20000);
  }
});
