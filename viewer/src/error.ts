import type { SourceData } from "./state";

import { arraysIdentical, getDefaultChannelLabels } from "./utils";
export function writeUserErrorMessage(error: Error) {
  return error.message;
}

export function sourceDataValid(sourceData: Array<PromiseSettledResult<SourceData[]>>): boolean {
  // An empty list means nothing was asked for, not that everything failed. `every` is
  // vacuously true for it, which previously reported "no sources" as a load failure.
  if (sourceData.length === 0) {
    return true;
  }
  return !sourceData.every((value) => value.status === "rejected");
}

export function getSourceDataError(sourceData: Array<PromiseSettledResult<SourceData[]>>): Error {
  const first = sourceData.at(0);
  if (first && "reason" in first) {
    return first.reason;
  }
  return Error("An unknown error occurred.");
}

export function getSourceDataWarnings(sourceData: SourceData): string[] {
  const warnings = [];
  if (arraysIdentical(sourceData.names, getDefaultChannelLabels(sourceData.names.length))) {
    warnings.push("Using default channel names because no valid channel names were found in the metadata.");
  }
  return warnings;
}
