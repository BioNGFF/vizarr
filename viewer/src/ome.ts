import pMap from "p-map";
import * as zarr from "zarrita";
import * as utils from "./utils";

import { ZarrPixelSource } from "./ZarrPixelSource";
import { coordinateTransformationsToMatrix, getPhysicalSizes } from "./coordinate-transformations";
import { createSourceData } from "./io";
import { log } from "./logger";
import type { Bf2RawOMEXML } from "./parsers/bioformats2raw";
import { parse } from "./parsers/parse";
import { getBf2RawImagePaths, getBf2rawOMEXML } from "./providers/bioformats2raw";
import { MetadataError, openZarrRoot } from "./services/http";
import type { ImageLabels, ImageLayerConfig, OnClickData, SourceData } from "./state";

export async function loadScene(
  config: ImageLayerConfig,
  grp: zarr.Group<zarr.Readable>,
  //No type information for SceneSchema
  scene: Ome.Scene,
): Promise<SourceData[]> {
  log.debug("Loading scene", { source: config.source });
  const results = await Promise.all(
    scene.coordinateTransformations.map(async (transformation: Ome.SceneTransformationMetadata) => {
      const path = transformation.input.path;
      log.debug("Creating source data for scene image", { path });
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
        log.debug("Applying scene transformations", { source: config.source });

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

/**
 * Metadata requests in flight while opening a grid of images.
 *
 * A grid opens one array per image per resolution level, so this is a few hundred small
 * requests. Measured against a 96-well, 5-level plate on IDR (581 requests): 3.8s at 16,
 * 2.5s here, 2.7s at 128 and 4.2s at 256, as the connections start to contend. At 64 the
 * whole pyramid costs about what the single lowest level used to.
 */
const GRID_OPEN_CONCURRENCY = 64;

/**
 * Open every resolution level of every image, returning one pyramid per path in the
 * order given, finest level first.
 *
 * Opens are queued flat, as one request each, rather than an image at a time. An image
 * is several requests, so limiting images would multiply the number in flight by the
 * depth of the pyramid and leave the queue far longer than it looks.
 *
 * Every image is assumed to have the same levels as the one the caller read its
 * datasets from, which is what being a grid of like images means. The grid layer clamps
 * per cell anyway, so a shallower image degrades rather than fails.
 */
async function openImagePyramids(
  grp: zarr.Group<zarr.Readable>,
  imagePaths: string[],
  datasetPaths: string[],
): Promise<Array<Array<zarr.Array<zarr.DataType, zarr.Readable>>>> {
  const opens = imagePaths.flatMap((imagePath, imageIndex) =>
    datasetPaths.map((datasetPath, level) => ({ imagePath, imageIndex, datasetPath, level })),
  );
  const pyramids: Array<Array<zarr.Array<zarr.DataType, zarr.Readable>>> = imagePaths.map(() => []);
  await pMap(
    opens,
    async ({ imagePath, imageIndex, datasetPath, level }) => {
      // @ts-expect-error - we don't need the meta for these arrays
      const arr: zarr.Array<zarr.DataType, zarr.Readable> = await zarr.open(
        grp.resolve(utils.join(imagePath, datasetPath)),
        { kind: "array", attrs: false },
      );
      pyramids[imageIndex][level] = arr;
    },
    { concurrency: GRID_OPEN_CONCURRENCY },
  );
  return pyramids;
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
  // Every level, finest first. A well used to load only the finest level of every field
  // at once, which made it more expensive than the plate it is opened from.
  const datasetPaths = imgAttrs.multiscales[0].datasets.map((dataset) => dataset.path);

  // Create loaders for every Image.
  const pyramids = await openImagePyramids(grp, imgPaths, datasetPaths);
  const axes = utils.getNgffAxes(imgAttrs.multiscales);
  const axis_labels = utils.getNgffAxisLabels(axes);

  const tileSize = utils.guessTileSize(pyramids[0][0]);
  const loaders = utils.range(rows).flatMap((row) => {
    // filter to remove any empty row/col position
    return utils
      .range(cols)
      .filter((col) => col + row * cols < pyramids.length)
      .map((col) => {
        const offset = col + row * cols;
        return {
          name: String(offset),
          row,
          col,
          sources: pyramids[offset].map((arr) => new ZarrPixelSource(arr, { labels: axis_labels, tileSize })),
        };
      });
  });

  let meta: Meta;
  if (utils.isOmeMultiscales(imgAttrs)) {
    meta = parseOmeroMeta(imgAttrs.omero, axes);
  } else {
    const lowres = loaders.at(-1)?.sources.at(-1);
    utils.assert(lowres, "Expected at least one resolution, found none.");
    meta = await defaultMeta(lowres, axis_labels);
  }

  const sourceData: SourceData = {
    loaders,
    ...meta,
    axis_labels,
    loader: loaders[0].sources,
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
    const gridCoord = info.gridCoord;
    if (!gridCoord) {
      return;
    }
    const { row, column } = gridCoord;
    const field = row * cols + column;
    const imgSource =
      typeof config.source === "string" && grp.path && !Number.isNaN(row) && !Number.isNaN(column)
        ? utils.join(config.source, imgPaths[field])
        : undefined;
    if (config.onClick) {
      info.layer = undefined;
      info.imageSource = imgSource;
      config.onClick(info);
    }
  };
  // Only where the host has not claimed the click. A host that handles it decides what
  // a click means, as it always has; otherwise the viewer navigates to the image.
  if (!config.onClick) {
    sourceData.resolveCellSource = ({ row, column }) => {
      if (typeof config.source !== "string" || !grp.path || Number.isNaN(row) || Number.isNaN(column)) {
        return undefined;
      }
      return utils.join(config.source, imgPaths[row * cols + column]);
    };
  }
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

  // A well holds one image per acquisition, and the plate can only draw one of them per
  // cell. Without a choice it draws the first, which is what it has always done; with
  // one it draws that acquisition across every well.
  const acquisitions = plateAttrs.acquisitions ?? [];
  const acquisitionId: number | undefined = config.acquisition ? Number.parseInt(config.acquisition) : undefined;

  // Fields are by index and we assume at least 1 per Well
  const wellPaths = plateAttrs.wells.map((well) => well.path);
  const zarrVersion = await utils.guessZarrVersion(grp);

  /** The image for the chosen acquisition, or the first where there is no choice. */
  function pickImage(images: Ome.Well["images"]) {
    if (acquisitionId === undefined) {
      return images[0];
    }
    // A well need not have been imaged in every acquisition; fall back rather than
    // dropping the well out of the plate entirely.
    return images.find((image) => image.acquisition === acquisitionId) ?? images[0];
  }

  // Use first image as proxy for others.
  const wellAttrs = await utils.getAttrsOnly<{ well: Ome.Well }>(grp, {
    path: wellPaths[0],
    zarrVersion,
  });
  utils.assert("well" in wellAttrs, "Path for image is not valid, not a well.");

  const imgPath = pickImage(wellAttrs.well.images).path;
  const imgAttrs = await utils.getAttrsOnly<Ome.Attrs>(grp, {
    path: utils.join(wellPaths[0], imgPath),
    zarrVersion,
  });
  utils.assert("multiscales" in imgAttrs, "Path for image is not valid.");

  // Every level, finest first. The grid layer chooses one per viewport, so unlike before
  // it needs the whole pyramid rather than just the lowest resolution.
  const { datasets } = imgAttrs.multiscales[0];
  const datasetPaths = datasets.map((dataset) => dataset.path);

  async function getImgPath(wellPath: string) {
    const wellAttrs = await utils.getAttrsOnly<{ well: Ome.Well }>(grp, {
      path: wellPath,
      zarrVersion,
    });
    utils.assert("well" in wellAttrs, "Path for image is not valid, not a well.");
    return utils.join(wellPath, pickImage(wellAttrs.well.images).path);
  }
  const wellImagePaths = await Promise.all(wellPaths.map(getImgPath));

  // Create loaders for every Well. Some loaders may be undefined if Wells are missing.
  const pyramids = await openImagePyramids(grp, wellImagePaths, datasetPaths);
  const axes = utils.getNgffAxes(imgAttrs.multiscales);
  const axis_labels = utils.getNgffAxisLabels(axes);
  const tileSize = utils.guessTileSize(pyramids[0][0]);
  const loaders = wellImagePaths.map((wellImagePath, index) => {
    const [row, col] = wellImagePath.split("/");
    return {
      name: `${row}${col}`,
      row: rows.indexOf(row),
      col: columns.indexOf(col),
      sources: pyramids[index].map((arr) => new ZarrPixelSource(arr, { labels: axis_labels, tileSize })),
    };
  });
  let meta: Meta;
  if ("omero" in imgAttrs) {
    meta = parseOmeroMeta(imgAttrs.omero, axes);
  } else {
    const lowres = loaders.at(-1)?.sources.at(-1);
    utils.assert(lowres, "Expected at least one resolution, found none.");
    meta = await defaultMeta(lowres, axis_labels);
  }

  // Load Image to use for channel names, rendering settings, sizeZ, sizeT etc.
  const sourceData: SourceData = {
    loaders,
    ...meta,
    axis_labels,
    loader: loaders[0].sources,
    model_matrix: utils.parseMatrix(config.model_matrix),
    defaults: {
      selection: meta.defaultSelection,
      colormap: config.colormap ?? "",
      opacity: config.opacity ?? 1,
    },
    name: plateAttrs.name || "Plate",
    rows: rows.length,
    columns: columns.length,
    // Only where there is a choice to make. A plate that declares a single acquisition
    // would otherwise get a dropdown whose two options do the same thing. This mirrors
    // the guard loadWell already applies.
    ...(acquisitions.length > 1 ? { acquisitions, acquisitionId: acquisitionId ?? -1 } : {}),
    rowNames: rows,
    columnNames: columns,
  };
  // Us onClick from image config or Open Well in new window
  sourceData.onClick = (info: OnClickData) => {
    const gridCoord = info.gridCoord;
    if (!gridCoord) {
      return;
    }
    const { row, column } = gridCoord;
    const imgSource =
      typeof config.source === "string" && grp.path && !Number.isNaN(row) && !Number.isNaN(column)
        ? utils.join(config.source, rows[row], columns[column])
        : undefined;
    if (config.onClick) {
      info.layer = undefined;
      info.imageSource = imgSource;
      config.onClick(info);
    }
  };
  if (!config.onClick) {
    sourceData.resolveCellSource = ({ row, column }) => {
      if (typeof config.source !== "string" || !grp.path || Number.isNaN(row) || Number.isNaN(column)) {
        return undefined;
      }
      return utils.join(config.source, rows[row], columns[column]);
    };
  }
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
  log.debug("Loading image", { source: config.source });
  const { name, opacity = 1, colormap = "" } = config;
  const data = await utils.loadMultiscales(grp, attrs.multiscales);
  const tileSize = utils.guessTileSize(data[0]);
  const coordinateSystems = attrs.multiscales[0].coordinateSystems
    ? attrs.multiscales[0].coordinateSystems
    : getDefaultCoordinateSystem(attrs.multiscales);
  const selectedCoordinateSystem = config.coordinateSystem
    ? coordinateSystems.filter((coordinateSystem) => {
        return coordinateSystem.name === config.coordinateSystem;
      })[0]
    : coordinateSystems[0];
  const axes = selectedCoordinateSystem.axes;

  const axis_labels = utils.getNgffAxisLabels(axes);
  let meta: Meta;
  if (utils.isOmeMultiscales(attrs)) {
    meta = parseOmeroMeta(attrs.omero, axes);
  } else {
    const lowresArray = data.at(-1);
    utils.assert(lowresArray, "Expected at least one resolution in multiscales, found none.");
    const lowresSource = new ZarrPixelSource(lowresArray, { labels: axis_labels, tileSize });
    meta = await defaultMeta(lowresSource, axis_labels);
  }

  const loader = await getImageLoader(attrs.multiscales, grp, axes);

  let labelGroup = grp;
  let labelPath = "labels";
  let labels: string[] = [];

  //Non-embedded label image
  if (config.label) {
    const labelStore = await utils.normalizeStore(config.label);
    labelGroup = await zarr.open(labelStore, { kind: "group" });
    labelPath = "";
    const labelAttrs = parse(labelGroup.attrs);
    if (labelAttrs?.type === "bf2Raw") {
      //@to-do temporary until transformer layer fully implemented
      const b2frawAttrs = (await getBf2rawOMEXML(config.label)) as Bf2RawOMEXML;
      labels = await getBf2RawImagePaths(labelGroup, b2frawAttrs);
    } else {
      labels = [""];
    }
  } else {
    labels = await resolveOmeLabelsFromMultiscales(labelGroup, labelPath);
  }
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
      labels.map((name) => loadOmeImageLabel(labelGroup.resolve(labelPath).resolve(name), name)),
    ),
  };
}

async function getImageLoader(multiscales: Ome.Multiscale[], grp: zarr.Group<zarr.Readable>, axes: Ome.Axis[]) {
  const data = await utils.loadMultiscales(grp, multiscales);

  const tileSize = utils.guessTileSize(data[0]);
  const axis_labels = utils.getNgffAxisLabels(axes);
  const originalSizeZ = data[0].shape[axis_labels.indexOf("z")];
  const zDownsampled = isDownsampledZ(data, axis_labels.indexOf("z"), originalSizeZ);
  const physicalSizes = getPhysicalSizes(axes, getHighestResolutionTransformations(multiscales));
  return data.map(
    (arr, i) =>
      new ZarrPixelSource(arr, {
        labels: axis_labels,
        tileSize,
        ...(i === 0 ? { meta: { physicalSizes } } : {}),
        originalSizeZ: zDownsampled ? originalSizeZ : undefined,
      }),
  );
}

async function loadOmeImageLabel(
  root: zarr.Location<zarr.Readable>,
  name: string,
  coordinateSystem?: string,
): Promise<ImageLabels[number]> {
  const store = root.store as zarr.FetchStore;
  const url = new URL(root.path.replace(/^\/+/, ""), store.url).href;
  const node = await openZarrRoot(url);
  const parsedAttrs = parse(node.attrs);
  // Unlike the callers that only probe what a group is, this one cannot proceed without
  // an answer. Saying so is what stops the unchecked cast below reaching the user as
  // "Cannot read properties of undefined".
  if (!parsedAttrs) {
    throw new MetadataError(
      `The label image at ${url} does not match any supported OME-NGFF version.`,
      "No OME-NGFF schema matched the group attributes.",
    );
  }

  //@to-do temporary until transformation layer implemented
  const attrs = parsedAttrs.data as Ome.LabelImage;
  const coordinateSystems = attrs.multiscales[0].coordinateSystems
    ? attrs.multiscales[0].coordinateSystems
    : getDefaultCoordinateSystem(attrs.multiscales);
  const selectedCoordinateSystem = coordinateSystem
    ? coordinateSystems.filter((system) => {
        return system.name === coordinateSystem;
      })[0]
    : coordinateSystems[0];
  const loader = await getImageLoader(attrs.multiscales, node, selectedCoordinateSystem.axes);
  const orderedTransformations = getOrderedTransformations(attrs.multiscales, selectedCoordinateSystem);
  const modelMatrix = coordinateTransformationsToMatrix(orderedTransformations, coordinateSystems[0].axes);
  const colors = (attrs["image-label"]?.colors ?? []).map((d) => ({ labelValue: d["label-value"], rgba: d.rgba }));
  const labelSource = {
    name,
    modelMatrix: modelMatrix,
    loader: loader,
    colors: colors.length > 0 ? colors : undefined,
  };
  return labelSource;
}

function resolveLabelAttrs(attrs: object): string[] {
  const parsedResult = parse(attrs);
  if (parsedResult?.success) {
    //*to-do temporary until transformation layer fully implemented
    const data = parsedResult.data as Ome.ImageLabelsList;
    return data.labels;
  }
  return [];
}

async function resolveOmeLabelsFromMultiscales(
  grp: zarr.Group<zarr.Readable>,
  labelPath: string,
): Promise<Array<string>> {
  try {
    const labelGroup = await zarr.open(grp.resolve(labelPath), { kind: "group" });
    return (resolveLabelAttrs(labelGroup.attrs) ?? []) as Array<string>;
  } catch (e) {
    utils.rethrowUnless(e, zarr.NodeNotFoundError);
    return [];
  }
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
