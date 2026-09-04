import * as zarr from "zarrita";
import { normalizeStore } from "../utils";

const MAYBE_CHROMIUM_CORS_ERROR_MESSAGE = "Failed to fetch";
const MAYBE_FIREFOX_CORS_ERROR_MESSAGE = "Load failed";
const MAYBE_SAFARI_CORS_ERROR_MESSAGE = "NetworkError when attempting to fetch resource.";

const MAYBE_CORS_ERROR_MESSAGES = [
  MAYBE_CHROMIUM_CORS_ERROR_MESSAGE,
  MAYBE_FIREFOX_CORS_ERROR_MESSAGE,
  MAYBE_SAFARI_CORS_ERROR_MESSAGE,
];

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

export async function openZarrRoot(source: string | zarr.Readable): Promise<zarr.Group<zarr.Readable<unknown>>> {
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

    //Catching 404 here is over-eager for some images, defer to zarrita for more accurate errors
    const store = await normalizeStore(source);
    const location = await zarr.open(store, { kind: "group" });
    return location;
  } catch (error) {
    if (error instanceof TypeError) {
      if (MAYBE_CORS_ERROR_MESSAGES.includes(error.message)) {
        throw new HttpError(
          `An unknown error occurred while trying to fetch the resource ${source} from the server - this is most likely a CORs issue.`,
          error.message,
        );
      }
    }

    if (error instanceof zarr.NodeNotFoundError) {
      throw new MetadataNotFoundError(
        `404: No valid metadata file found at zarr group ${source}, please check the specified URL is correct.`,
        error.message,
      );
    }

    throw error;
  }
}
