/**
 * Cloud storage URIs, resolved to URLs a browser can actually fetch.
 *
 * `s3://` and `gs://` are not network protocols. S3's wire protocol is HTTPS and the URI
 * is a naming convention the AWS CLI introduced; every client that accepts one -- boto3,
 * s3fs, zarr-python, the CLI itself -- parses it and issues an HTTPS request. This does
 * the same, once, before a store is built, so everything downstream of it is working with
 * a URL that can be opened.
 *
 * A browser could not do otherwise. `fetch` has a fixed set of schemes and no registry to
 * extend, a service worker only ever sees http(s) requests, and `registerProtocolHandler`
 * is for navigation rather than fetching. Translation is not a shortcut here; it is the
 * whole implementation, in every client there is.
 *
 * Anonymous access only. There are no credentials in a page, so this reaches public
 * buckets and nothing else, and whether a public bucket can be read from a page at all is
 * the bucket owner's CORS decision rather than ours.
 */

/** Where a bare `s3://` URI points, since the URI itself names no endpoint. */
const AWS_ENDPOINT = "s3.amazonaws.com";

/** Google Cloud Storage publishes one endpoint, and addresses buckets path-style. */
const GCS_ENDPOINT = "storage.googleapis.com";

/** Written out for the message a user sees when they give us something else. */
export const SUPPORTED_SCHEMES = ["https://", "http://", "s3://", "s3+https://", "s3+http://", "gs://"];

/**
 * `s3://bucket/key` against Amazon's own endpoint.
 *
 * Virtual-hosted addressing, except where the bucket name contains a dot: the wildcard
 * certificate for `*.s3.amazonaws.com` does not cover a second label, so a dotted name
 * fails TLS before it gets as far as failing anything else. Path-style has no such
 * problem and is the fallback for exactly that case.
 *
 * No region appears here, and none should. A URI carries no region, and the global
 * endpoint routes to the right one -- whereas a guess is a hard failure: the global
 * endpoint serves `janelia-cosem-datasets`, while `s3.us-west-2.amazonaws.com` answers
 * for it with a 301, because despite appearances the bucket is in `us-east-1`.
 */
function amazonUrl(uri: URL): string {
  const bucket = uri.hostname;
  const rest = `${uri.pathname}${uri.search}${uri.hash}`;
  if (bucket.includes(".")) {
    return `https://${AWS_ENDPOINT}/${bucket}${rest}`;
  }
  return `https://${bucket}.${AWS_ENDPOINT}${rest}`;
}

/** `gs://bucket/key`, which has one endpoint and one addressing style. */
function googleUrl(uri: URL): string {
  return `https://${GCS_ENDPOINT}/${uri.hostname}${uri.pathname}${uri.search}${uri.hash}`;
}

/**
 * Put back the `+` that a query string turns into a space.
 *
 * `?source=s3+https://host/bucket/key` is how anyone will write the link, and by the time
 * `URLSearchParams` has decoded it the scheme reads `s3 https:` -- a `+` in a query string
 * means a space, and nothing warns you. Neuroglancer does not meet this because it keeps
 * its state in the fragment; vizarr takes a query parameter, so it does.
 *
 * Unambiguous to undo: no scheme contains a space, so a source beginning `s3 http` can
 * only ever be this. A link vizarr writes itself is already correct, since
 * `URLSearchParams` escapes the plus on the way out; this is for the ones people type.
 */
function restorePlus(source: string): string {
  return source.startsWith("s3 http") ? `s3+${source.slice("s3 ".length)}` : source;
}

/**
 * Resolve a cloud storage URI to an HTTPS URL, or return the source untouched.
 *
 * Total and pure: anything that is not a URI we understand comes back exactly as it was
 * given, including a relative path, so this can sit in front of every source without
 * having to know what else a source might be.
 *
 * `s3+https://endpoint/bucket/key` names an S3-compatible server -- MinIO, the EBI
 * Embassy buckets, Filebase -- and follows neuroglancer, so that a link means the same
 * thing in both. **The first path segment after the host is always the bucket**, which
 * makes resolving it nothing more than dropping the prefix.
 *
 * Neuroglancer documents its own form as ambiguous, since the host may itself be a
 * bucket, and resolves that by probing. The ambiguity is avoidable: where the host is the
 * bucket, the plain `https://` URL already works and there is nothing for an S3 scheme to
 * add. Declaring the one reading costs nothing and removes the probe.
 */
export function resolveCloudUri(source: string): string {
  let uri: URL;
  try {
    uri = new URL(restorePlus(source));
  } catch {
    // Not a URL at all. A relative path, or something another store will make sense of;
    // either way not ours to rewrite.
    return source;
  }
  switch (uri.protocol) {
    case "s3:":
      return amazonUrl(uri);
    case "gs:":
      return googleUrl(uri);
    case "s3+https:":
    case "s3+http:":
      // Path-style by definition, so the path already reads the way the request needs it.
      // The scheme still earns its keep: it is what makes the address unambiguous without
      // a probe, and it is where anything S3-specific would hang if it is ever needed.
      return uri.href.slice("s3+".length);
    default:
      return source;
  }
}
