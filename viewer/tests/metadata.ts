import fs from "node:fs";
import path from "node:path";
import ZipFileStore from "@zarrita/storage/zip";
import pMap from "p-map";
import { stringify } from "yaml";
import * as zarr from "zarrita";
import { createSourceData } from "../src/io";
import { getSceneImagePaths } from "../src/ome";
import type { Bf2RawOMEXML } from "../src/parsers/bioformats2raw";
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

function joinSourcePath(source: string, path: string): string {
  return `${source}/${path}`.replace(/([^:]\/)\/+/g, "$1");
}

/**
 * `parse` returns a union over every schema it knows, so narrowing on `type` alone
 * leaves `data` as `unknown`: the version is still open, and each version transforms
 * to its own shape. The schema that matched guarantees the shape, so each branch
 * asserts the one it asked for -- which is what src/io.ts and src/ome.ts do at their
 * own call sites.
 */
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
      const image = attrs.data as { multiscales: Ome.Multiscale[]; omero?: Ome.Omero };
      metadata.multiscale = image.multiscales[0].datasets?.length > 1;
      metadata.transformations = collectTransformationTypes(image.multiscales[0].coordinateTransformations);
      metadata.channels = image.omero?.channels.map((channel) => {
        return channel.label;
      });
      const sourceData = await createSourceData({ source: url });
      metadata.labels = sourceData[0].labels?.length;
    }

    if (attrs.type === "bf2Raw") {
      const parsedOMEXML = (await getBf2rawOMEXML(url)) as Bf2RawOMEXML;
      const imagePaths = await getBf2RawImagePaths(node, parsedOMEXML);
      metadata.images = await Promise.all(
        imagePaths.map((imagePath) => createImageMetadata(joinSourcePath(url, imagePath))),
      );
    }

    if (attrs.type === "scene") {
      const scene = (attrs.data as { scene: Ome.Scene }).scene;
      metadata.transformations = collectTransformationTypes(scene.coordinateTransformations);
      const imagePaths = getSceneImagePaths(scene);
      metadata.images = await Promise.all(
        imagePaths.map((imagePath) => createImageMetadata(joinSourcePath(url, imagePath))),
      );
    }

    if (attrs.type === "well") {
      const { well } = attrs.data as { well: Ome.Well };
      metadata.images = Object.fromEntries(
        await Promise.all(
          well.images.map(async ({ path }) => [path, await createImageMetadata(joinSourcePath(url, path))] as const),
        ),
      );
    }

    if (attrs.type === "plate") {
      const { columns, rows, wells: listedWells } = (attrs.data as { plate: Ome.Plate }).plate;
      const wells: Record<string, unknown> = Object.fromEntries(
        rows.flatMap(({ name: row }) => columns.map(({ name: column }) => [`${row}/${column}`, {}] as const)),
      );
      const occupiedWells = await pMap(
        listedWells,
        async ({ path }) => {
          const wellMetadata = await createImageMetadata(joinSourcePath(url, path));
          return [path, wellMetadata.images ?? {}] as const;
        },
        { concurrency: 10 },
      );
      Object.assign(wells, Object.fromEntries(occupiedWells));
      metadata.wells = wells;
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

export function getYamlFileNames(filepath: string) {
  return fs.readdirSync(filepath).filter((fileName) => fileName.endsWith(".yaml"));
}

export function writeUntestableYaml(url: string, imageName: string, savePath: string) {
  fs.writeFileSync(
    path.join(savePath, imageName),
    stringify({
      source: url,
      name: imageName,
      testable: false,
    }),
  );
}
