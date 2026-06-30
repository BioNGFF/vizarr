import type { Logger } from "./api";
import type { SourceData } from "./state";

import { arraysIdentical, getDefaultChannelLabels } from "./utils";
export function writeUserErrorMessage(error: Error) {
  return error.message;
}

export function sourceDataValid(sourceData: Array<PromiseSettledResult<SourceData>>): boolean {
  if (sourceData.every((value) => value.status === "rejected")) {
    return false;
  }
  return true;
}

export function getSourceDataError(sourceData: Array<PromiseSettledResult<SourceData>>): Error {
  if ("reason" in sourceData[0]) {
    return sourceData[0].reason;
  }
  return Error("An unknown error occurred.");
}

export function getSourceDataWarnings(sourceData: SourceData): string[] {
  const warnings = [];
  if (arraysIdentical(sourceData.names, getDefaultChannelLabels(sourceData.names.length))) {
    warnings.push("Channel metadata either does not exist or was not loaded correctly.");
  }
  return warnings;
}

export function handleError(error: Error, logger: Logger) {
  logger.error(error.message);
  throw error;
}
