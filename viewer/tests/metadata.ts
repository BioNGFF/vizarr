import fs from "node:fs";
import path from "node:path";
import ZipFileStore from "@zarrita/storage/zip";
import { stringify } from "yaml";
import * as zarr from "zarrita";
import { createSourceData } from "../src/io";
import { getSceneImagePaths } from "../src/ome";
import { parse } from "../src/parsers/parse";
import { narrowVersionAndType } from "../src/parsers/shallow-parse";
import { getBf2RawImagePaths, getBf2rawOMEXML } from "../src/providers/bioformats2raw";
import { openZarrRoot } from "../src/services/http";
import { guessZarrVersion } from "../src/utils";

type TransformationLike = { type: string; transformations?: TransformationLike[] };

function collectTransformationTypes(transformations?: TransformationLike[]): string[] {
  const types = new Set<string>();
  for (const t of transformations ?? []) {
    types.add(t.type);
    if (t.transformations) {
      for (const nestedType of collectTransformationTypes(t.transformations)) {
        types.add(nestedType);
      }
    }
  }
  return Array.from(types);
}

export async function createImageMetadata(url: string) {
  const node = await openZarrRoot(url);
  const { version, type } = narrowVersionAndType(node.attrs);
  const attrs = parse(node.attrs);
  let metadata: Record<string, unknown> = {};
  metadata.source = url;
  metadata.zarr_version = await guessZarrVersion(node);
  metadata.version = version;
  metadata.type = type;
  metadata.zipped = node.store instanceof ZipFileStore;

  if (attrs) {
    if (attrs.type === "image") {
      metadata.multiscale = attrs.data.multiscales[0].datasets?.length > 1;
      metadata.transformations = collectTransformationTypes(attrs.data.multiscales[0].coordinateTransformations);
      metadata.channels = attrs.data.omero?.channels.map((channel) => {
        return channel.label;
      });
      const sourceData = await createSourceData({ source: url });
      metadata.labels = sourceData[0].labels?.length;
    }

    if (attrs.type === "bf2Raw") {
      const parsedOMEXML = await getBf2rawOMEXML(url);
      const imagePaths = await getBf2RawImagePaths(node, parsedOMEXML);
      metadata.images = await Promise.all(
        imagePaths.map((imagePath) => createImageMetadata(`${url}/${imagePath}`.replace(/([^:]\/)\/+/g, "$1"))),
      );
    }

    if (attrs.type === "scene") {
      const scene = attrs.data.scene as Ome.Scene;
      metadata.transformations = collectTransformationTypes(scene.coordinateTransformations);
      const imagePaths = getSceneImagePaths(scene);
      metadata.images = await Promise.all(
        imagePaths.map((imagePath) => createImageMetadata(`${url}/${imagePath}`.replace(/([^:]\/)\/+/g, "$1"))),
      );
    }
  }

  return metadata;
}

//Zarr version, sharding, zip
export async function writeImageYaml(url: string, imageName: string, savePath: string) {
  const metadata = await createImageMetadata(url);
  metadata.name = imageName;
  metadata.testable = true;

  fs.writeFileSync(path.join(savePath, imageName), stringify(metadata));
}

export function getYamlFileNames(filepath) {
  return fs.readdirSync(filepath).filter((fileName) => fileName.endsWith(".yaml"));
}

export function writeUntestableYaml(url, imageName, savePath) {
  fs.writeFileSync(
    path.join(savePath, imageName),
    stringify({
      source: url,
      name: imageName,
      testable: false,
    }),
  );
}
