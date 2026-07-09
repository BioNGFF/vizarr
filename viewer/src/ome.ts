import pMap from "p-map";
import * as zarr from "zarrita";
import * as utils from "./utils";
import { z } from "zod";
import * as xml2js from "xml-js";

import { coordinateTransformationsToMatrix, getPhysicalSizes } from "./coordinate-transformations";
import type { ImageLabels, ImageLayerConfig, OnClickData, SourceData } from "./state";
import { ZarrPixelSource } from "./ZarrPixelSource";
import { createSourceData } from "./io";
import * as bf2raw from "./parsers/bioformats2raw";

const XML_METADATA_LOCATION = "OME";
const XML_METADATA_FILE_NAME = "METADATA.ome.xml";

function unpackText(node: {}) {
  if (Array.isArray(node)) {
    return node.map(unpackText);
  }

  if (node && typeof node === "object") {
    const keys = Object.keys(node);

    // Only contains _text
    if (keys.length === 1 && keys[0] === "_text") {
      return node._text;
    }

    const out = {};
    for (const key of keys) {
      out[key] = unpackText(node[key]);
    }
    return out;
  }

  return node;
}

function unpackProperty(obj: {}, property: string): {} {
  if (obj === null || typeof obj !== "object") {
    return;
  }

  if (obj[property] && typeof obj[property] === "object" && !Array.isArray(obj[property])) {
    Object.assign(obj, obj[property]);
    delete obj[property];
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      unpackProperty(value, property);
    }
  }

  return obj;
}

function OMEXMLToObject(xmlString: string): Record<string, unknown> {
  const result = xml2js.xml2js(xmlString, {
    compact: true,
    ignoreAttributes: false,
    nativeType: true,
    nativeTypeAttributes: true,
    alwaysArray: [
      "Image",
      "Channel",
      "Plate",
      "Well",
      "WellSample",
      "Instrument",
      "PlateAcquisition",
      "Objective",
      "Microscope",
      "LightSourceGroup",
      "Detector",
      "Objective",
      "FilterSet",
      "Filter",
      "Dichroic",
      "AnnotationRef",
      "Plane",
      "XMLAnnotation",
      "MapAnnotation",
    ],
  });

  const unpackedAttributes = unpackProperty(result, "_attributes");
  const unpackedText = unpackText(unpackedAttributes);
  return unpackedText;
}

export async function loadBf2Raw(
  config: ImageLayerConfig,
  grp: zarr.Group<zarr.Readable>,
  metadata: Ome.Bioformats2rawlayout,
) {
  if ("plate" in metadata) {
    return;
  }
  const xml = await fetch(`${config.source}/${XML_METADATA_LOCATION}/${XML_METADATA_FILE_NAME}`);

  const xmlString = await xml.text();
  const xmlAsObject = OMEXMLToObject(xmlString);
  const parsedData = bf2raw.parse(xmlAsObject);
  return parsedData;
}

export async function loadScene(
  config: ImageLayerConfig,
  grp: zarr.Group<zarr.Readable>,
  //No type information for SceneSchema
  scene: Ome.Scene,
): Promise<SourceData[]> {
  console.log("Loading scene: ", config.source);
  const results = await Promise.all(
    scene.coordinateTransformations.map(async (transformation: Ome.SceneTransformationMetadata) => {
      const path = transformation.input.path;
      const sourceDatas = await createSourceData({
        source: `${config.source}/${path}`,
        coordinateSystem: transformation.input.name,
      });

      sourceDatas.map((sourceData) => {
        const transformations = scene.coordinateTransformations.filter(
          (transformation: Ome.SceneTransformationMetadata) => {
            return transformation.input.path === path;
          },
        );
        console.log("Applying scene transformations to image: ", config.source);

        // @TODO For now we are assuming there is only a single coordinateSystem defined at the scene level
        // Provision is made in the specification for multiple
        // In this case we must provide a way for the user to change between coordinate systems
        // For now we just select the first coordinate system in the list
        const axes = scene.coordinateSystems ? scene.coordinateSystems[0].axes : getDefaultCoordinateSystem()[0].axes;

        const sceneModelMatrix = coordinateTransformationsToMatrix(transformations, axes);
        const modelMatrix = sourceData.model_matrix.multiplyLeft(sceneModelMatrix);
        sourceData.model_matrix = modelMatrix;
      });

      return sourceDatas;
    }),
  );
  return results.flat();
}

export async function loadWell(
  config: ImageLayerConfig,
  grp: zarr.Group<zarr.Readable>,
  wellAttrs: Ome.Well,
): Promise<SourceData> {
  // Can filter Well fields by URL query ?acquisition=ID
  const acquisitionId: number | undefined = config.acquisition ? Number.parseInt(config.acquisition) : undefined;
  let acquisitions: Ome.Acquisition[] = [];

  utils.assert(wellAttrs?.images, "Well .zattrs missing images");
  utils.assert(grp.path, "Cannot inspect zarr path to open well.");

  const [row, col] = grp.path.split("/").filter(Boolean).slice(-2);

  let { images } = wellAttrs;

  // Do we have more than 1 Acquisition?
  const acqIds = images.flatMap((img) => (img.acquisition ? [img.acquisition] : []));

  if (acqIds.length > 1) {
    // Need to get acquisitions metadata from parent Plate
    const platePath = grp.path.replace(`${row}/${col}`, "");
    const plate = await zarr.open(grp.resolve(platePath));
    const plateAttrs = utils.resolveAttrs(plate.attrs) as { plate: Ome.Plate };
    acquisitions = plateAttrs.plate.acquisitions ?? [];

    // filter imagePaths by acquisition
    if (acquisitionId && acqIds.includes(acquisitionId)) {
      images = images.filter((img) => img.acquisition === acquisitionId);
    }
  }

  const imgPaths = images.map((img) => img.path);
  const cols = Math.ceil(Math.sqrt(imgPaths.length));
  const rows = Math.ceil(imgPaths.length / cols);

  // Use first image for rendering settings, resolutions etc.
  const first = await zarr.open(grp.resolve(imgPaths[0]), { kind: "group" });
  const imgAttrs = utils.resolveAttrs(first.attrs);

  utils.assert(utils.isMultiscales(imgAttrs), "Path for image is not valid.");
  let resolution = imgAttrs.multiscales[0].datasets[0].path;

  // Create loader for every Image.
  const promises = imgPaths.map((p) => {
    const loc = grp.resolve(utils.join(p, resolution));
    // @ts-expect-error - ok flag to avoid loading unused attrs
    const arr: zarr.Array<zarr.DataType, zarr.Readable> = zarr.open(loc, { kind: "array", attrs: false });
    return arr;
  });
  const data = await Promise.all(promises);
  const axes = utils.getNgffAxes(imgAttrs.multiscales);
  const axis_labels = utils.getNgffAxisLabels(axes);

  const tileSize = utils.guessTileSize(data[0]);
  const loaders = utils.range(rows).flatMap((row) => {
    // filter to remove any empty row/col position
    return utils
      .range(cols)
      .filter((col) => col + row * cols < data.length)
      .map((col) => {
        const offset = col + row * cols;
        return {
          name: String(offset),
          row,
          col,
          loader: new ZarrPixelSource(data[offset], { labels: axis_labels, tileSize }),
        };
      });
  });

  let meta: Meta;
  if (utils.isOmeMultiscales(imgAttrs)) {
    meta = parseOmeroMeta(imgAttrs.omero, axes);
  } else {
    const lowres = loaders.at(-1);
    utils.assert(lowres, "Expected at least one resolution, found none.");
    meta = await defaultMeta(lowres.loader, axis_labels);
  }

  const sourceData: SourceData = {
    loaders,
    ...meta,
    axis_labels,
    loader: [loaders[0].loader],
    model_matrix: utils.parseMatrix(config.model_matrix),
    defaults: {
      selection: meta.defaultSelection,
      colormap: config.colormap ?? "",
      opacity: config.opacity ?? 1,
    },
    name: `Well ${row}${col}`,
  };
  if (acquisitions.length > 0) {
    // To show acquisition chooser in UI
    sourceData.acquisitions = acquisitions;
    sourceData.acquisitionId = acquisitionId || -1;
  }

  sourceData.rows = rows;
  sourceData.columns = cols;
  sourceData.onClick = (info: OnClickData) => {
    let gridCoord = info.gridCoord;
    if (!gridCoord) {
      return;
    }
    const { row, column } = gridCoord;
    let imgSource = undefined;
    if (typeof config.source === "string" && grp.path && !Number.isNaN(row) && !Number.isNaN(column)) {
      const field = row * cols + column;
      imgSource = utils.join(config.source, imgPaths[field]);
    }
    if (config.onClick) {
      info.layer = undefined;
      info.imageSource = imgSource;
      config.onClick(info);
    } else if (imgSource) {
      window.open(`${window.location.origin + window.location.pathname}?source=${imgSource}`);
    }
  };
  return sourceData;
}

export async function loadPlate(
  config: ImageLayerConfig,
  grp: zarr.Group<zarr.Readable>,
  plateAttrs: Ome.Plate,
): Promise<SourceData> {
  utils.assert(plateAttrs?.rows || plateAttrs?.columns, "Plate .zattrs missing rows, columns or wells");

  const rows = plateAttrs.rows.map((row) => row.name);
  const columns = plateAttrs.columns.map((row) => row.name);

  // Fields are by index and we assume at least 1 per Well
  const wellPaths = plateAttrs.wells.map((well) => well.path);
  const zarrVersion = await utils.guessZarrVersion(grp);

  // Use first image as proxy for others.
  const wellAttrs = await utils.getAttrsOnly<{ well: Ome.Well }>(grp, {
    path: wellPaths[0],
    zarrVersion,
  });
  utils.assert("well" in wellAttrs, "Path for image is not valid, not a well.");

  const imgPath = wellAttrs.well.images[0].path;
  const imgAttrs = await utils.getAttrsOnly<Ome.Attrs>(grp, {
    path: utils.join(wellPaths[0], imgPath),
    zarrVersion,
  });
  utils.assert("multiscales" in imgAttrs, "Path for image is not valid.");

  // Lowest resolution is the 'path' of the last 'dataset' from the first multiscales
  const { datasets } = imgAttrs.multiscales[0];
  const resolution = datasets[datasets.length - 1].path;

  async function getImgPath(wellPath: string) {
    const wellAttrs = await utils.getAttrsOnly<{ well: Ome.Well }>(grp, {
      path: wellPath,
      zarrVersion,
    });
    utils.assert("well" in wellAttrs, "Path for image is not valid, not a well.");
    return utils.join(wellPath, wellAttrs.well.images[0].path);
  }
  const wellImagePaths = await Promise.all(wellPaths.map(getImgPath));

  // Create loader for every Well. Some loaders may be undefined if Wells are missing.
  const mapper = async ([key, path]: string[]) => {
    // @ts-expect-error - we don't need the meta for these arrays
    let arr: zarr.Array<zarr.DataType, zarr.Readable> = await zarr.open(grp.resolve(path), {
      kind: "array",
      attrs: false,
    });
    return [key, arr] as const;
  };

  const promises = await pMap(
    wellImagePaths.map((p) => [p, utils.join(p, resolution)]),
    mapper,
    { concurrency: 10 },
  );
  const data = await Promise.all(promises);
  const axes = utils.getNgffAxes(imgAttrs.multiscales);
  const axis_labels = utils.getNgffAxisLabels(axes);
  const tileSize = utils.guessTileSize(data[0][1]);
  const loaders = data.map((d) => {
    const [row, col] = d[0].split("/");
    return {
      name: `${row}${col}`,
      row: rows.indexOf(row),
      col: columns.indexOf(col),
      loader: new ZarrPixelSource(d[1], { labels: axis_labels, tileSize }),
    };
  });
  let meta: Meta;
  if ("omero" in imgAttrs) {
    meta = parseOmeroMeta(imgAttrs.omero, axes);
  } else {
    const lowres = loaders.at(-1);
    utils.assert(lowres, "Expected at least one resolution, found none.");
    meta = await defaultMeta(lowres.loader, axis_labels);
  }

  // Load Image to use for channel names, rendering settings, sizeZ, sizeT etc.
  const sourceData: SourceData = {
    loaders,
    ...meta,
    axis_labels,
    loader: [loaders[0].loader],
    model_matrix: utils.parseMatrix(config.model_matrix),
    defaults: {
      selection: meta.defaultSelection,
      colormap: config.colormap ?? "",
      opacity: config.opacity ?? 1,
    },
    name: plateAttrs.name || "Plate",
    rows: rows.length,
    columns: columns.length,
    rowNames: rows,
    columnNames: columns,
  };
  // Us onClick from image config or Open Well in new window
  sourceData.onClick = (info: OnClickData) => {
    let gridCoord = info.gridCoord;
    if (!gridCoord) {
      return;
    }
    const { row, column } = gridCoord;
    let imgSource = undefined;
    if (typeof config.source === "string" && grp.path && !Number.isNaN(row) && !Number.isNaN(column)) {
      imgSource = utils.join(config.source, rows[row], columns[column]);
    }
    if (config.onClick) {
      info.layer = undefined;
      info.imageSource = imgSource;
      config.onClick(info);
    } else if (imgSource) {
      window.open(`${window.location.origin + window.location.pathname}?source=${imgSource}`);
    }
  };
  return sourceData;
}

function isDownsampledZ(
  data: Array<zarr.Array<zarr.DataType, zarr.Readable>>,
  zIndex: number,
  originalSizeZ: number,
): boolean {
  return !data.every((element) => element.shape[zIndex] === originalSizeZ);
}

//@ TODO
//This behaviour needs investigating - only the highest resolution transformation is applied to the image
//Not sure what impact this has on image rendering
function getResolutionTransformations(metadata: Ome.Multiscale[]): Ome.CoordinateTransformation[] {
  return metadata[0].datasets[0]?.coordinateTransformations ? metadata[0].datasets[0]?.coordinateTransformations : [];
}

function getImageTransformations(metadata: Ome.Multiscale[]): Ome.CoordinateTransformation[] {
  return metadata[0].coordinateTransformations ? metadata[0].coordinateTransformations : [];
}

function getOrderedTransformations(
  metadata: Ome.Multiscale[],
  coordinateSystem: Ome.CoordinateSystem,
): Ome.CoordinateTransformation[] {
  const resolutionTransformations = getResolutionTransformations(metadata);
  const imageTransformations = getImageTransformations(metadata);
  const transformations = [
    ...resolutionTransformations,
    ...imageTransformations.filter((transformation) => {
      return transformation.output === coordinateSystem.name;
    }),
  ];

  return transformations;
}

function getHighestResolutionTransformations(metadata: Ome.Multiscale[]): Ome.CoordinateTransformation[] {
  const transformations = metadata[0].datasets[0].coordinateTransformations;
  return transformations ? transformations : [];
}

//Updating pre-0.6 axes to use the 0.6 coordinate systems metadata
// @ TODO
//Should be moved to the parsing layer
//Unknown is suitable here because we really don't know anything about the structure of the data
function getDefaultCoordinateSystem(multiscales: unknown[] = []): Ome.CoordinateSystem[] {
  //Try to extract axes metadata
  if (
    typeof multiscales[0] === "object" &&
    multiscales[0] &&
    "axes" in multiscales[0] &&
    Array.isArray(multiscales[0].axes)
  ) {
    return [
      {
        name: "default",
        axes: multiscales[0].axes.map((axis) => {
          if (typeof axis === "object" && "name" in axis) {
            return axis;
          }
          if (typeof axis === "string") {
            return { name: axis, type: "space" };
          }
          return { name: "default", ...axis };
        }),
      },
    ];
  }
  return [
    {
      name: "default",
      axes: [
        { type: "channel", name: "c" },
        { type: "space", name: "z" },
        { type: "space", name: "y" },
        { type: "space", name: "x" },
      ],
    },
  ];
}

/**
 * Load a multiscale OME-NGFF image
 */
export async function loadOmeMultiscales(
  config: ImageLayerConfig,
  grp: zarr.Group<zarr.Readable>,
  attrs: { multiscales: Ome.Multiscale[] },
): Promise<SourceData> {
  console.log("Loading image: ", config.source);
  const { name, opacity = 1, colormap = "" } = config;
  const data = await utils.loadMultiscales(grp, attrs.multiscales);
  const axes = utils.getNgffAxes(attrs.multiscales);
  const axis_labels = utils.getNgffAxisLabels(axes);
  const tileSize = utils.guessTileSize(data[0]);
  const coordinateSystems = attrs.multiscales[0].coordinateSystems
    ? attrs.multiscales[0].coordinateSystems
    : getDefaultCoordinateSystem(attrs.multiscales);
  const selectedCoordinateSystem = config.coordinateSystem
    ? coordinateSystems.filter((coordinateSystem) => {
      return coordinateSystem.name === config.coordinateSystem;
    })[0]
    : coordinateSystems[0];
  let meta: Meta;
  if (utils.isOmeMultiscales(attrs)) {
    meta = parseOmeroMeta(attrs.omero, axes);
  } else {
    const lowresArray = data.at(-1);
    utils.assert(lowresArray, "Expected at least one resolution in multiscales, found none.");
    const lowresSource = new ZarrPixelSource(lowresArray, { labels: axis_labels, tileSize });
    meta = await defaultMeta(lowresSource, axis_labels);
  }
  const originalSizeZ = data[0].shape[axis_labels.indexOf("z")];
  const zDownsampled = isDownsampledZ(data, axis_labels.indexOf("z"), originalSizeZ);
  const physicalSizes = getPhysicalSizes(axes, getHighestResolutionTransformations(attrs.multiscales));
  const loader = data.map(
    (arr, i) =>
      new ZarrPixelSource(arr, {
        labels: axis_labels,
        tileSize,
        ...(i === 0 ? { meta: { physicalSizes } } : {}),
        originalSizeZ: zDownsampled ? originalSizeZ : undefined,
      }),
  );
  const labels = await resolveOmeLabelsFromMultiscales(grp);
  const orderedTransformations = getOrderedTransformations(attrs.multiscales, selectedCoordinateSystem);
  const modelMatrix = coordinateTransformationsToMatrix(orderedTransformations, coordinateSystems[0].axes);
  return {
    loader: loader,
    axis_labels,
    model_matrix: modelMatrix,
    defaults: {
      selection: meta.defaultSelection,
      colormap,
      opacity,
    },
    ...meta,
    name: meta.name ?? name,
    labels: await Promise.all(
      labels.map((name) => loadOmeImageLabel(grp.resolve("labels"), name, selectedCoordinateSystem.name)),
    ),
  };
}

async function loadOmeImageLabel(
  root: zarr.Location<zarr.Readable>,
  name: string,
  coordinateSystemName: string,
): Promise<ImageLabels[number]> {
  const grp = await zarr.open(root.resolve(name), { kind: "group" });
  const attrs = utils.resolveAttrs(grp.attrs);
  utils.assert(utils.isOmeImageLabel(attrs), "No 'image-label' metadata.");
  const data = await utils.loadMultiscales(grp, attrs.multiscales);
  const baseResolution = data.at(0);
  utils.assert(baseResolution, "No base resolution found for multiscale labels.");
  const tileSize = utils.guessTileSize(baseResolution);
  const coordinateSystems = attrs.multiscales[0].coordinateSystems
    ? attrs.multiscales[0].coordinateSystems
    : getDefaultCoordinateSystem(attrs.multiscales);
  const selectedCoordinateSystem = coordinateSystems.filter((coordinateSystem) => {
    return coordinateSystem.name === coordinateSystemName;
  })[0];
  const coordinateSystem = selectedCoordinateSystem ? selectedCoordinateSystem : coordinateSystems[0];

  const labels = utils.getNgffAxisLabels(coordinateSystem.axes);
  const colors = (attrs["image-label"].colors ?? []).map((d) => ({ labelValue: d["label-value"], rgba: d.rgba }));
  return {
    name,
    modelMatrix: coordinateTransformationsToMatrix(
      getOrderedTransformations(attrs.multiscales, coordinateSystem),
      coordinateSystem.axes,
    ),
    loader: data.map((arr) => new ZarrPixelSource(arr, { labels, tileSize })),
    colors: colors.length > 0 ? colors : undefined,
  };
}

const LabelSchema = z.object({
  labels: z.array(z.string()),
});
const OmeLabelSchema = z.object({
  ome: z.object({
    labels: z.array(z.string()),
  }),
});

function resolveLabelAttrs(attrs: unknown): string[] {
  if (LabelSchema.safeParse(attrs).success) {
    return LabelSchema.parse(attrs).labels;
  }
  if (OmeLabelSchema.safeParse(attrs).success) {
    return OmeLabelSchema.parse(attrs).ome.labels;
  }
  return [];
}

async function resolveOmeLabelsFromMultiscales(grp: zarr.Group<zarr.Readable>): Promise<Array<string>> {
  return zarr
    .open(grp.resolve("labels"), { kind: "group" })
    .then(({ attrs }) => {
      return (resolveLabelAttrs(attrs) ?? []) as Array<string>;
    })
    .catch((e) => {
      utils.rethrowUnless(e, zarr.NodeNotFoundError);
      return [];
    });
}

type Meta = {
  name: string | undefined;
  names: Array<string>;
  colors: Array<string>;
  contrast_limits: Array<[number, number] | undefined>;
  visibilities: Array<boolean>;
  channel_axis: number | null;
  defaultSelection: Array<number>;
};

async function defaultMeta(loader: ZarrPixelSource, axis_labels: string[]): Promise<Meta> {
  const channel_axis = axis_labels.indexOf("c");
  const channel_count = channel_axis === -1 ? 1 : loader.shape[channel_axis];
  const visibilities = utils.getDefaultVisibilities(channel_count);
  const contrast_limits = await utils.calcConstrastLimits(loader, channel_axis, visibilities);
  const colors = utils.getDefaultColors(channel_count, visibilities);
  return {
    name: "Image",
    names: utils.range(channel_count).map((i) => `channel_${i}`),
    colors,
    contrast_limits,
    visibilities,
    channel_axis: axis_labels.includes("c") ? axis_labels.indexOf("c") : null,
    defaultSelection: axis_labels.map(() => 0),
  };
}

function setVisibilities(channels: Ome.Channel[]): boolean[] {
  const visibilities: boolean[] = [];
  if (
    !channels.some((channel) => {
      "active" in channel;
    })
  ) {
    for (const channel of channels) {
      visibilities.push(true);
    }
  } else {
    for (const channel of channels) {
      visibilities.push(channel.active);
    }
  }
  return visibilities;
}

function parseOmeroMeta({ rdefs, channels, name }: Ome.Omero, axes: Ome.Axis[]): Meta {
  const t = rdefs?.defaultT ?? 0;
  const z = rdefs?.defaultZ ?? 0;
  const greyscale = rdefs?.model === "greyscale";

  const colors: string[] = [];
  const contrast_limits: [min: number, max: number][] = [];
  const visibilities: boolean[] = setVisibilities(channels);
  const names: string[] = [];

  channels.forEach((c, index) => {
    colors.push(c.color);
    contrast_limits.push([c.window.start, c.window.end]);
    names.push(c.label || `${index}`);
  });

  if (greyscale && colors.length === 1) {
    colors[0] = "FFFFFF";
  }

  const defaultSelection = axes.map((axis) => {
    if (axis.type === "time") return t;
    if (axis.name === "z") return z;
    return 0;
  });
  const channel_axis = axes.findIndex((axis) => axis.type === "channel");

  return {
    name,
    names,
    colors,
    contrast_limits,
    visibilities,
    channel_axis,
    defaultSelection,
  };
}
