import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import yaml from "yaml";
import { narrowVersionAndType } from "../src/parsers/shallow-parse";
import { openZarrRoot } from "../src/services/http";
import { getYamlFileNames } from "./metadata";

const imagesPath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "generic"));

const files = getYamlFileNames(imagesPath);

files.map(async (file) => {
  const filePath = path.join(imagesPath, file);
  const description = yaml.parse(fs.readFileSync(filePath, "utf8"));

  if (description.testable) {
    test(`Can infer version and image type of ${description.source}`, async () => {
      const node = await openZarrRoot(description.source);

      const versionInfo = narrowVersionAndType(node.attrs);
      expect(typeof versionInfo.version).toBe("string");
      expect(typeof versionInfo.type).toBe("string");
    }, 20000);
  }
});
