import { describe, expect, test } from "vitest";
import { resolveCloudUri } from "../src/cloud-uri";

/**
 * The mapping from a cloud storage URI to a url a browser can fetch.
 *
 * Offline and pure, because the mapping is a decision rather than an observation: what
 * `s3://bucket/key` ought to resolve to does not depend on whether a bucket happens to be
 * reachable this afternoon. That a resolved url actually opens is a separate claim, and
 * is tested against real buckets in `tests/remote/cloud-uri.test.ts`.
 */

describe("s3://", () => {
  test("resolves to Amazon's virtual-hosted endpoint", () => {
    expect(resolveCloudUri("s3://janelia-cosem-datasets/jrc_hela-2/jrc_hela-2.zarr")).toBe(
      "https://janelia-cosem-datasets.s3.amazonaws.com/jrc_hela-2/jrc_hela-2.zarr",
    );
  });

  test("names no region", () => {
    // A URI carries no region and the global endpoint routes for us. Guessing is not a
    // near miss but a hard failure: janelia-cosem-datasets answers on the global endpoint
    // and 301s on s3.us-west-2, because the bucket is in us-east-1.
    expect(resolveCloudUri("s3://some-bucket/key")).not.toContain("us-");
  });

  test("falls back to path-style for a bucket name containing a dot", () => {
    // `my.images.s3.amazonaws.com` is not covered by the `*.s3.amazonaws.com` wildcard
    // certificate, so virtual-hosted addressing fails TLS before anything else.
    expect(resolveCloudUri("s3://my.images/plate.zarr")).toBe("https://s3.amazonaws.com/my.images/plate.zarr");
  });

  test("resolves a bucket root", () => {
    expect(resolveCloudUri("s3://bucket")).toBe("https://bucket.s3.amazonaws.com");
  });

  test("keeps a query string and a fragment", () => {
    expect(resolveCloudUri("s3://bucket/key?versionId=7#frag")).toBe(
      "https://bucket.s3.amazonaws.com/key?versionId=7#frag",
    );
  });
});

describe("gs://", () => {
  test("resolves to the Google Cloud Storage endpoint, path-style", () => {
    expect(resolveCloudUri("gs://cmip6/some/path.zarr")).toBe("https://storage.googleapis.com/cmip6/some/path.zarr");
  });

  test("does not special-case a dotted bucket, which needs no special case", () => {
    expect(resolveCloudUri("gs://my.images/plate.zarr")).toBe("https://storage.googleapis.com/my.images/plate.zarr");
  });
});

describe("s3+https:// and s3+http://", () => {
  test("names an S3-compatible endpoint with the bucket as the first path segment", () => {
    expect(resolveCloudUri("s3+https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0062A/6001240.zarr")).toBe(
      "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0062A/6001240.zarr",
    );
  });

  test("keeps a port, which a local MinIO needs", () => {
    expect(resolveCloudUri("s3+http://localhost:9000/my-bucket/image.zarr")).toBe(
      "http://localhost:9000/my-bucket/image.zarr",
    );
  });

  test("survives a query string turning its plus into a space", () => {
    // `?source=s3+https://…` arrives from `URLSearchParams` as `s3 https://…`, because a
    // plus in a query string means a space. Left alone it is not a scheme at all.
    expect(resolveCloudUri("s3 https://uk1s3.embassy.ebi.ac.uk/idr/x.zarr")).toBe(
      "https://uk1s3.embassy.ebi.ac.uk/idr/x.zarr",
    );
    expect(resolveCloudUri("s3 http://localhost:9000/my-bucket/image.zarr")).toBe(
      "http://localhost:9000/my-bucket/image.zarr",
    );
  });

  test("does not treat the host as a bucket", () => {
    // The ambiguity neuroglancer documents and resolves by probing. We resolve it by
    // declaring one reading: the first path segment after the host is always the bucket.
    // Where the host *is* the bucket there is nothing to declare, because the plain
    // https url already works.
    expect(resolveCloudUri("s3+https://ome-zarr-rfc4.s3.filebase.io/ome-zarr/x.zarr")).toBe(
      "https://ome-zarr-rfc4.s3.filebase.io/ome-zarr/x.zarr",
    );
  });
});

describe("everything else is left alone", () => {
  test.each([
    ["an https url", "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0062A/6001240.zarr"],
    ["an http url", "http://localhost:8080/data.zarr"],
    ["a relative path", "./fixtures/image.zarr"],
    ["a bare name", "image.zarr"],
    ["a scheme we do not support", "az://container/image.zarr"],
    ["a reference spec", "https://example.com/refs.json"],
  ])("%s", (_, source) => {
    expect(resolveCloudUri(source)).toBe(source);
  });

  test("an unsupported scheme is returned rather than thrown on", () => {
    // Returning it is what lets the failure be diagnosed where the other failures are,
    // with the url in hand, instead of here where there is no reader to tell.
    expect(() => resolveCloudUri("abfs://container/image.zarr")).not.toThrow();
  });
});
