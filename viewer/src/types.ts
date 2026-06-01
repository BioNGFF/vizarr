declare namespace Ome {
  type Version = "0.1";

  interface Channel {
    active: boolean;
    coefficient: number;
    color: string;
    family: string;
    inverted: boolean;
    label?: string;
    window: {
      end: number;
      max?: number;
      min?: number;
      start: number;
    };
  }

  interface Omero {
    id: number;
    name?: string;
    version: Version;
    channels: Channel[];
    rdefs: {
      defaultT?: number;
      defaultZ?: number;
      model: "color" | "greyscale";
    };
  }

  interface Axis {
    name: string;
    type?: string;
    unit?: string;
  }

  interface CoordinateSystem {
    name: string;
    axes: Axis[];
  }

  type TransformationMetadata = {
    input?: string;
    output?: string;
  };

  type SceneTransformationMetadata = {
    input: { path?: string; name: string };
  };

  interface Scene {
    coordinateTransformations: SceneCoordinateTransformation[];
    coordinateSystems?: CoordinateSystem[];
  }

  //Once parsing and transforming is set up, it should be possible to significantly simplify these types
  type IdentityTransformation = { type: "identity" };
  type ScaleTransformation = { type: "scale"; scale: Array<number> };
  type TranslationTranformation = { type: "translation"; translation: Array<number> };
  type SequenceTransformation = {
    type: "sequence";
    transformations: Array<CoordinateTransformation>;
  };
  type RotationTransformation = { type: "rotation"; rotation: Array<Array<number>> };
  type AffineTransformation = { type: "affine"; affine: Array<Array<number>> };

  type CoordinateTransformationType =
    | IdentityTransformation
    | ScaleTransformation
    | TranslationTranformation
    | SequenceTransformation
    | RotationTransformation
    | AffineTransformation;

  type CoordinateTransformation = TransformationMetadata & CoordinateTransformationType;

  type SceneCoordinateTransformation = SceneTransformationMetadata & CoordinateTransformationType;

  interface Dataset {
    path: string;
    coordinateTransformations?: Array<CoordinateTransformation>;
  }

  interface Multiscale {
    datasets: Array<Dataset>;
    version?: string;
    coordinateSystems: CoordinateSystem[];
    selectedCoordinateSystem: string;
    coordinateTransformations?: CoordinateTransformation[];
  }

  interface Bioformats2rawlayout {
    "bioformats2raw.layout": 3;
  }

  interface Acquisition {
    id: number;
    name?: string;
    maximumfieldcount?: number;
    description?: string;
    starttime?: number;
    /**
     * @deprecated
     */
    path?: string;
  }

  interface Plate {
    acquisitions?: Acquisition[];
    columns: { name: string }[];
    field_count: 4;
    name: string;
    rows: { name: string }[];
    version: Version;
    wells: { path: string }[];
  }

  interface Well {
    images: { path: string; acquisition?: number }[];
    version: Version;
  }

  interface ImageLabel {
    version: Version;
    colors?: Array<{
      "label-value": number;
      rgba: [r: number, g: number, b: number, a: number];
    }>;
    properties?: Array<{
      "label-value": number;
      "omero:roiId": number;
      "omero:shapeId": number;
    }>;
    /** Location of source image */
    source: {
      image: string;
    };
  }

  type Attrs =
    | { multiscales: Multiscale[] }
    | { omero: Omero; multiscales: Multiscale[] }
    | { plate: Plate }
    | { well: Well }
    | { "image-label": ImageLabel; multiscales: Multiscale[] };
}
