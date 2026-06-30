import type { Logger } from "./api";
import type { SourceData } from "./state";

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

export function handleError(error: Error, logger: Logger) {
  logger.error(error.message);
  throw error;
}
