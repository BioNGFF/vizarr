import * as zarr from "zarrita";
import { normalizeStore } from "../utils";

const MAYBE_CORS_ERROR_MESSAGE = "Failed to fetch";

export class HttpError extends Error {
  message: string;
  cause: string;
  code?: number;
  constructor(message: string, cause: string, code?: number) {
    super(message);
    this.name = "HttpError";
    this.message = message;
    this.cause = cause;
    this.code = code;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export class MetadataError extends Error {
  message: string;
  cause: string;
  constructor(message: string, cause: string) {
    super(message);
    this.name = "MetadataError";
    this.message = message;
    this.cause = cause;
    Object.setPrototypeOf(this, MetadataError.prototype);
  }
}

export class MetadataNotFoundError extends MetadataError {
  constructor(message: string, cause: string) {
    super(message, cause);
    this.name = "MetadataNotFoundError";
    this.message = message;
    this.cause = cause;
    Object.setPrototypeOf(this, MetadataNotFoundError.prototype);
  }
}

export async function openZarrRoot(
  source: string | zarr.Readable,
): Promise<zarr.Group<zarr.Readable<unknown>> | undefined> {
  let url: string;

  if (typeof source === "string") {
    url = source;
  } else {
    url = zarr.root(source).path;
  }
  try {
    const { statusText, status } = await fetch(url, { method: "GET" });
    if (status === 400) {
      throw new HttpError(
        `400: The server could not process the request to access the resource at ${source}. The request was invalid.`,
        statusText,
        status,
      );
    }

    if (status === 404) {
      throw new HttpError(
        `404: Resource at ${source} could not be found. Please check the specified URL is correct and that the resource still exists.`,
        statusText,
        status,
      );
    }
    if (status === 403) {
      throw new HttpError(
        `403: Unauthorized to access resource at ${source}. Please check the specified URL is correct and that permission to access it is not restricted.`,
        statusText,
        status,
      );
    }

    if (status === 401) {
      throw new HttpError(
        `401: Unauthorized to access resource at ${source}. Please check the specified URL is correct and that permission to access it is not restricted.`,
        statusText,
        status,
      );
    }

    const store = await normalizeStore(source);
    const location = await zarr.open(store, { kind: "group" });
    return location;
  } catch (error) {
    if (error instanceof TypeError) {
      if (error.message === MAYBE_CORS_ERROR_MESSAGE) {
        throw new HttpError(
          `An unknown error occurred while trying to fetch the resource ${source} from the server - this is most likely a CORs issue.`,
          error.message,
        );
      }
    }

    if (error instanceof zarr.NodeNotFoundError) {
      throw new MetadataNotFoundError(`No valid metadata file found at zarr group ${source}`, error.message);
    }

    throw error;
  }
}
