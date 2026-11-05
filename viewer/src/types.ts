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

  /**
   * Which way a spatial axis runs, from its lowest coordinate to its highest.
   *
   * RFC-4. `anterior-to-posterior` means coordinates increase towards the back, so this
   * describes the coordinate system the spatial metadata establishes, not array index
   * order; it composes with `coordinateTransformations` rather than contradicting them.
   *
   * https://ngff.openmicroscopy.org/rfc/4/index.html
   */
  interface Orientation {
    /** Only "anatomical" is defined. The RFC reserves room for other domains. */
    type: string;
    /** One of the 24 direction pairs, e.g. "left-to-right". */
    value: string;
  }

  interface Axis {
    name: string;
    type?: string;
    unit?: string;
    /** RFC-4, on spatial axes only. Absent and null mean the same thing. */
    orientation?: Orientation | null;
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

  // TODO
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
    plate?: Plate;
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

  interface ImageLabelsList {
    labels: string[];
  }

  interface LabelImage {
    multiscales: Multiscale[];
    "image-label": ImageLabel;
  }

  type Attrs =
    | { multiscales: Multiscale[] }
    | { omero: Omero; multiscales: Multiscale[] }
    | { plate: Plate }
    | { well: Well }
    | { "image-label": ImageLabel; multiscales: Multiscale[] };
}
