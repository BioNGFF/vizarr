import { imageTransformers } from "./ImageTransformers";

export function transform(data: { data; version; type }) {
  return imageTransformers.find((transformer) => transformer.version === data.version)?.transformer(data.data);
}
