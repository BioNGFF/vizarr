/**
 * Where a credential enters, for stores that are not open to the world.
 *
 * Vizarr is purely client-side, so anything it holds the user holds and can read out of
 * devtools. That is the line this module is drawn along: it carries a credential someone
 * else issued, and it never earns one. A bearer token, a cookie the browser already has,
 * a query string the url arrived with -- yes. A cloud secret key to sign requests with --
 * no, because signing in the browser means the secret is in the browser.
 *
 * @see {@href https://github.com/BioNGFF/vizarr/issues/181} for the measurements this is built on
 * @module
 */
import type * as zarr from "zarrita";
import { log } from "./logger";

/** What the viewer is about to read, when it asks for a credential. */
export type CredentialRequest = {
  /** The absolute url of the request. */
  url: string;
  /**
   * True when a credential for this url was just rejected.
   *
   * A provider holding a cached token should mint a fresh one rather than hand back the
   * one that failed, which is what makes refresh-on-expiry work rather than loop.
   */
  retry: boolean;
};

/**
 * Supplies what a request needs to be allowed.
 *
 * `{ headers }` carries a bearer token, `{ credentials: "include" }` sends a session
 * cookie the browser already holds, and `{}` is correct for a store guarded by something
 * the request cannot carry at all, such as an IP allowlist.
 *
 * Async because loading starts the moment a source is set, so anything that has to wait
 * on a sign-in would otherwise always be too late for the first request.
 */
export type CredentialProvider = (request: CredentialRequest) => RequestInit | Promise<RequestInit>;

/**
 * One provider for the page, set from `createViewer`'s options or the `credentials` prop,
 * following how `logger` is treated. Two viewers on one page therefore share a provider;
 * nobody has needed otherwise.
 */
let provider: CredentialProvider | undefined;

export function setCredentialProvider(next: CredentialProvider | undefined): void {
  provider = next;
}

/**
 * What to send with a request to `url`, or nothing when no provider is configured.
 *
 * A provider that throws is reported and treated as having nothing to offer: a broken
 * sign-in should produce the viewer's ordinary "cannot read this" message, not an
 * unhandled rejection from inside chunk loading.
 */
export async function credentialsFor(url: string, retry = false): Promise<RequestInit> {
  if (!provider) {
    return {};
  }
  try {
    return (await provider({ url, retry })) ?? {};
  } catch (error) {
    log.warn("The credential provider failed; the request will be made without one", error);
    return {};
  }
}

/** Whether a provider is configured at all, so callers can skip work when one is not. */
export function hasCredentialProvider(): boolean {
  return provider !== undefined;
}

/**
 * Whether a failure means "your credential was wrong" rather than "there is nothing here".
 *
 * zarrita's `handle_response` maps 404 to absent and throws a plain `Error` for everything
 * else, with the status only in the message text -- so reading it back out is the only
 * route available. `tests/credentials.test.ts` pins that shape, so an upgrade that changes
 * the wording fails loudly here rather than quietly stopping every retry.
 */
export function isUnauthorized(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const status = error.message.match(/Unexpected response status (\d+)/)?.[1];
  return status === "401" || status === "403";
}

/** `fetch`, carrying a credential, and asking for a fresh one if the first is refused. */
export async function fetchWithCredentials(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, merge(init, await credentialsFor(url)));
  if (!hasCredentialProvider() || (response.status !== 401 && response.status !== 403)) {
    return response;
  }
  log.debug("Request refused, asking the credential provider again", { url, status: response.status });
  return fetch(url, merge(init, await credentialsFor(url, true)));
}

/** Later wins, except for headers, which combine -- as zarrita's own `merge_init` does. */
function merge(base: RequestInit, extra: RequestInit): RequestInit {
  return {
    ...base,
    ...extra,
    headers: { ...base.headers, ...extra.headers },
  };
}

/**
 * The absolute url a store key resolves to, which is what the provider is asked about.
 *
 * Mirrors `FetchStore.resolve`, including copying the base url's query string onto every
 * key: a store opened at `…/image.zarr?sig=x` reaches its chunks with that query intact,
 * and a provider deciding what to send should see the url as it will actually be sent.
 */
function absoluteUrl(base: string, key: string): string {
  const url = new URL(key, base);
  url.search = new URL(base).search;
  return url.href;
}

/**
 * Consults the provider for every read, and retries once if a credential is refused.
 *
 * Per request rather than once per store because that is the only shape in which a token
 * can expire mid-session and be replaced. It costs an `await` per chunk, which is nothing
 * next to the request it is attached to, and nothing at all when no provider is set.
 *
 * The retry depends on #183: before it, a rejected read stayed in the cache and the second
 * attempt never reached the network.
 */
export function withCredentials<S extends zarr.AsyncReadable<RequestInit>>(store: S, base: string): S {
  const get = store.get.bind(store);
  const getRange = store.getRange?.bind(store);

  async function authenticated<T>(url: string, attempt: (init: RequestInit) => Promise<T>): Promise<T> {
    try {
      return await attempt(await credentialsFor(url));
    } catch (error) {
      if (!hasCredentialProvider() || !isUnauthorized(error)) {
        throw error;
      }
      log.debug("Read refused, asking the credential provider again", { url });
      return attempt(await credentialsFor(url, true));
    }
  }

  const wrapped: zarr.AsyncReadable<RequestInit> = {
    get: (key, opts = {}) => authenticated(absoluteUrl(base, key), (init) => get(key, merge(opts, init))),
  };
  if (getRange) {
    wrapped.getRange = (key, range, opts = {}) =>
      authenticated(absoluteUrl(base, key), (init) => getRange(key, range, merge(opts, init)));
  }
  return wrapped as S;
}
