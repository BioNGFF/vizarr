import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import yaml from "yaml";
import { createSourceData } from "../src/io";

test(
  "Resolution-level transformations should be applied",
  async () => {
    const sourcePath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "resolution_transformationsv0.5.yaml"));
    const source = yaml.parse(fs.readFileSync(sourcePath, "utf-8"));
    const sourceData = await createSourceData(source);
    const expectedValues = [0.108335, 0, 0, 0, 0, 0.108335, 0, 0, 0, 0, 0.4, 0, 60.88427, 52.109135, 1.2, 1];
    expect(Array.from(sourceData[0].model_matrix)).toEqual(expectedValues);
  },
  30000,
);

test("Image-level transformations should be applied", async () => {
  const sourcePath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "transformationsv0.5.yaml"));
  const source = yaml.parse(fs.readFileSync(sourcePath, "utf-8"));
  await createSourceData(source);
});

test(
  "Can read a scene image and apply transformations",
  async () => {
    const sourcePath = path.resolve(path.join(__dirname, "..", "..", "fixtures", "scene.yaml"));
    const source = yaml.parse(fs.readFileSync(sourcePath, "utf-8"));
    const sourceDatas = await createSourceData(source);

    const expectedMatrices = [
      [0.10202959397405088, 0, 0, 0, 0, 0.10202959397405088, 0, 0, 0, 0, 0.5920416817598223, 0, 0, 0, 0, 1],
      [
        0.10202959397405088, 0, 0, 0, 0, 0.10202959397405088, 0, 0, 0, 0, 0.5920416817598223, 0, 61.21775638443053,
        30.608878192215265, 0, 1,
      ],
      [
        0.10202959397405088, 0, 0, 0, 0, 0.10202959397405088, 0, 0, 0, 0, 0.5920416817598223, 0, 91.8266345766458,
        91.8266345766458, 0, 1,
      ],
    ];

    for (const [index, sourceData] of sourceDatas.entries()) {
      expect(Array.from(sourceData.model_matrix)).toEqual(expectedMatrices[index]);
    }
  },
  30000,
);
