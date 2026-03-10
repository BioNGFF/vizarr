import { AssertionError } from "./utils";
import { type SourceData } from "./state";


export const errorToMessageMapping: Record<string, string> = {
  "Store does not support range requests": "Sharded .ozx files are not currently supported.",
  "Failed to fetch": "An error occurred while trying to fetch the file from the server - this is likely a CORs issue.",
  "Node not found: v3 array or group":
    "No valid .zattrs, .zarray, .zgroup, or zarr.json was found at this URL - please check that the file exists and is correctly formatted.",
};

export function writeUserErrorMessage(error: Error) {
  if (error instanceof AssertionError) {
    //Error message is raised by this application
    return error.message;
  }
  //Error raised externally
  if (Object.keys(errorToMessageMapping).includes(error.message)) {
    return errorToMessageMapping[error.message];
  } else {
    return "An unknown error occurred.";
  }
}

export function sourceDataValid(sourceData: any[]): boolean {
  debugger;
  if (sourceData.every((value) => value.status === "rejected")) {
    return false;
  }
  return true;
}

export function getSourceDataError(sourceData: any[]): Error {
  return sourceData[0].reason;
}
