import fs from "node:fs";
import path from "node:path";
import ZipFileStore from "@zarrita/storage/zip";
import { stringify } from "yaml";
import { createSourceData } from "../src/io";
import { openZarrRoot } from "../src/services/http";
import { narrowVersionAndType } from "../src/parsers/shallow-parse";
import { parse } from "../src/parsers/parse";
import { getSceneImagePaths } from "../src/ome";
import { getBf2RawImagePaths, getBf2rawOMEXML } from "../src/providers/bioformats2raw";
import { guessZarrVersion } from "../src/utils";
import * as zarr from "zarrita";

// Builds the metadata dictionary for a single OME-Zarr source. For bf2Raw layouts, this
// recurses into each underlying image so `images` contains the same shape of metadata as
// a plain image source.
export async function createImageMetadata(url: string) {
  const node = await openZarrRoot(url);
  const { version, type } = narrowVersionAndType(node.attrs);
  const attrs = parse(node.attrs);
  let metadata = {};
  metadata.source = url;
  metadata.zarr_version = await guessZarrVersion(node);
  metadata.version = version;
  metadata.type = type;
  metadata.zipped = node.store instanceof ZipFileStore;

  if (attrs) {
    if (attrs.type === "image") {
      metadata.multiscale = attrs.data.multiscales[0].datasets?.length > 1;
      metadata.transformations = attrs.data.multiscales[0].coordinateTransformations?.map(
        (transformation) => transformation.type,
      );
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

