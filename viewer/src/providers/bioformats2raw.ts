import { createSourceData } from "../io";
import * as bf2raw from "../parsers/bioformats2raw";
import type { ImageLayerConfig } from "../state";

import * as xml2js from "xml-js";
import * as zarr from "zarrita";

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

function getDefaultSeries(length: number) {
  return Array.from({ length: length }, (_, i) => i.toString());
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
  const parsedData = bf2raw.parseOMEXML(xmlAsObject);
  let series;
  try {
    const OMENode = await zarr.open(grp.resolve("OME"), { kind: "group" });
    const OMEZattrs = bf2raw.parseOMEZattrs(OMENode.attrs);
    series = OMEZattrs.series;
  } catch (error) {
    //console.log(error);
  } finally {
    series = getDefaultSeries(parsedData?.OME.Image.length);
  }
  console.log(series, config.source);
  const results = await Promise.all(
    series.flatMap((imagePath) => {
      return createSourceData({ source: `${config.source}/${imagePath}` });
    }),
  );
  return results.flat();
}
