import { getLabelSchemas, parse } from "./parse";

export function parseLabels(attrs: unknown) {
  const parsedResult = parse(attrs, getLabelSchemas());
  if (parsedResult.success) {
    return parsedResult.data;
  }
  return attrs;
}
