export const imageTransformers = [
  { version: "v01", transformer: transformImagev01 },
  { version: "v02", transformer: transformImagev02 },
  { version: "v03", transformer: transformImagev03 },
  { version: "v04", transformer: transformImagev04 },
  { version: "v05", transformer: transformImagev05 },
  { version: "v06", transformer: transformImagev06 },
];

export function transformImagev01(image) {
  return image;
}

export function transformImagev02(image) {
  return image;
}

export function transformImagev03(image) {
  return image;
}

export function transformImagev04(image) {
  return image;
}

export function transformImagev05(image) {
  return removeOmeAttribute(image);
}

export function transformImagev06(image) {
  return removeOmeAttribute(image);
}

export function removeOmeAttribute(attrs) {
  console.log("REMOVING OME ATTRIBUTE");
  return { ...attrs.ome };
}
