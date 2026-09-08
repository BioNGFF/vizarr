import { createSourceData } from "../io";
import * as bf2raw from "../parsers/bioformats2raw";
import type { ImageLayerConfig, SourceData } from "../state";

import * as xml2js from "xml-js";
import * as zarr from "zarrita";

const XML_METADATA_LOCATION = "OME";
const XML_METADATA_FILE_NAME = "METADATA.ome.xml";

function unpackText(node: xml2js.ElementCompact): xml2js.ElementCompact | string {
  if (Array.isArray(node)) {
    return node.map(unpackText);
  }

  if (node && typeof node === "object") {
    const keys = Object.keys(node);

    // Only contains _text
    if (keys.length === 1 && keys[0] === "_text" && typeof node._text === "string") {
      return node._text;
    }

    const out: xml2js.ElementCompact = {};
    for (const key of keys) {
      out[key] = unpackText(node[key]);
    }
    return out;
  }

  return node;
}

function unpackProperty(obj: xml2js.ElementCompact, property: string): xml2js.ElementCompact {
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

function OMEXMLToObject(xmlString: string): xml2js.ElementCompact {
  const result = xml2js.xml2js(xmlString, {
    compact: true,
    ignoreAttributes: false,
    nativeType: true,
    //@ts-ignore
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
  if (typeof unpackedText === "string") {
    throw new Error("Expected object, received string");
  }
  return unpackedText;
}

function getDefaultSeries(length: number) {
  return Array.from({ length: length }, (_, i) => i.toString());
}

export async function loadBf2Raw(
  config: ImageLayerConfig,
  grp: zarr.Group<zarr.Readable>,
  metadata: Ome.Bioformats2rawlayout,
): Promise<SourceData[]> {
  if ("plate" in metadata) {
    return createSourceData(config);
  }
  const xml = await fetch(`${config.source}/${XML_METADATA_LOCATION}/${XML_METADATA_FILE_NAME}`);

  const xmlString = await xml.text();
  const xmlAsObject = OMEXMLToObject(xmlString);
  const parsedData = bf2raw.parseOMEXML(xmlAsObject);
  if (!parsedData?.OME.Image) {
    throw new Error();
  }
  let series: string[] | undefined;
  try {
    const OMENode = await zarr.open(grp.resolve("OME"), { kind: "group" });
    const OMEZattrs = bf2raw.parseOMEZattrs(OMENode.attrs);
    series = OMEZattrs?.series;
  } catch (error) {
  } finally {
    series = getDefaultSeries(parsedData?.OME.Image.length);
  }
  const results = await Promise.all(
    series.flatMap((imagePath) => {
      return createSourceData({ source: `${config.source}/${imagePath}` });
    }),
  );
  return results.flat();
}
