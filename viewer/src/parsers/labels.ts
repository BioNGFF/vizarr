import { parse } from "./parse";

export function parseLabels(attrs: object) {
  const parsedResult = parse(attrs);
  if (parsedResult?.success) {
    return parsedResult.data;
  }
  return attrs;
}
