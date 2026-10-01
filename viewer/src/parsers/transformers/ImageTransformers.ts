/**
 *@module
 *Metadata transformations applied to all OME-NGFF zarr metadata
 */

export function transformImagev01(image: unknown) {
  return image;
}

export function transformImagev02(image: unknown) {
  return image;
}

export function transformImagev03(image: unknown) {
  return image;
}

export function transformImagev04(image: unknown) {
  return image;
}

export function transformImagev05<T extends object>(image: { ome: T }): T {
  return removeOmeAttribute(image);
}

export function transformImagev06<T extends object>(image: { ome: T }): T {
  return removeOmeAttribute(image);
}

export function removeOmeAttribute<T extends object>(attrs: { ome: T }): T {
  return { ...attrs.ome };
}
