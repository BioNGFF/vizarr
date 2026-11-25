import * as zarr from "zarrita";
import { SUPPORTED_SCHEMES, resolveCloudUri } from "../cloud-uri";
import { log } from "../logger";
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
export class UnsupportedSchemeError extends Error {
  cause: string;
  constructor(message: string, cause: string) {
    super(message);
    this.name = "UnsupportedSchemeError";
    this.cause = cause;
    Object.setPrototypeOf(this, UnsupportedSchemeError.prototype);
  }
}

function isCorsFailure(error: unknown): error is TypeError {
  return error instanceof TypeError && MAYBE_CORS_ERROR_MESSAGES.includes(error.message);
}

/**
 * The scheme of a url, once the cloud URIs have been resolved away, or undefined where
 * the source is not a url at all.
 */
function unfetchableScheme(url: string): string | undefined {
  let protocol: string;
  try {
    ({ protocol } = new URL(url));
  } catch {
    return undefined;
  }
  return protocol === "http:" || protocol === "https:" ? undefined : protocol;
}

/**
 * Ask the server directly what it makes of the url.
 *
 * Only called once an open has already failed. zarrita reports failures in its own
 * terms — a missing node, or a message with the status embedded in the text — which is
 * accurate but not something to show a user, and matching on its wording would break
 * the moment that wording changed. One request against the url the user actually gave
 * us is a more durable way to say why it did not work.
 */
async function explainFailure(source: string | zarr.Readable, url: string, error: unknown): Promise<Error> {
  // Before anything else, because a scheme the browser cannot speak fails as a TypeError
  // with the same message a blocked request produces, and would otherwise be reported as
  // a CORS problem. It is not: nothing was sent. Telling someone to go and look at a
  // bucket policy for a request that never left the browser costs them an afternoon.
  const scheme = unfetchableScheme(url);
  if (scheme) {
    log.debug("Open failed, scheme is not fetchable", { url, scheme });
    return new UnsupportedSchemeError(
      `${scheme}// is not an address a browser can open. Vizarr understands ${SUPPORTED_SCHEMES.join(", ")}.`,
      `Unsupported scheme ${scheme} in ${source}`,
    );
  }

  // A blocked request never reaches the server, so there is nothing to ask it about.
  if (isCorsFailure(error)) {
    log.debug("Open failed, classified as CORS", { url, cause: error.message });
    return new HttpError(
      `An unknown error occurred while trying to fetch the resource ${source} from the server - this is most likely a CORs issue.`,
      error.message,
    );
  }

  let status: number | undefined;
  let statusText = "";
  try {
    ({ status, statusText } = await fetch(url, { method: "GET" }));
  } catch (probeError) {
    if (isCorsFailure(probeError)) {
      log.debug("Open failed, probe blocked, classified as CORS", { url });
      return new HttpError(
        `An unknown error occurred while trying to fetch the resource ${source} from the server - this is most likely a CORs issue.`,
        probeError.message,
      );
    }
  }
  log.debug("Open failed, probed source", { url, status, error });

  if (status === 400) {
    return new HttpError(
      `400: The server could not process the request to access the resource at ${source}. The request was invalid.`,
      statusText,
      status,
    );
  }

  if (status === 403) {
    return new HttpError(
      `403: Unauthorized to access resource at ${source}. Please check the specified URL is correct and that permission to access it is not restricted.`,
      statusText,
      status,
    );
  }

  if (status === 401) {
    return new HttpError(
      `401: Unauthorized to access resource at ${source}. Please check the specified URL is correct and that permission to access it is not restricted.`,
      statusText,
      status,
    );
  }

  if (error instanceof zarr.NodeNotFoundError) {
    return new MetadataNotFoundError(
      `404: No valid metadata file found at zarr group ${source}, please check the specified URL is correct.`,
      error.message,
    );
  }

  return error instanceof Error ? error : Error(String(error));
}

export async function openZarrRoot(source: string | zarr.Readable): Promise<zarr.Group<zarr.Readable<unknown>>> {
  // The resolved url, not the one the user gave us: this is what a probe has to be made
  // against. Their own source string is what the messages quote back at them.
  const url = typeof source === "string" ? resolveCloudUri(source) : zarr.root(source).path;
  log.debug("Opening source", { url });

  // zarrita first. It has to make these requests anyway, so probing the url up front
  // only added a round trip to every successful load — and against the group directory,
  // which is not a real resource and returns whatever the server feels like (a 409, in
  // one case). We only ask the server to explain itself once something has gone wrong.
  try {
    const store = await normalizeStore(source);
    return await zarr.open(store, { kind: "group" });
  } catch (error) {
    throw await explainFailure(source, url, error);
  }
}
