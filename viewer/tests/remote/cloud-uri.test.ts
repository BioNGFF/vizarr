import { expect, test } from "vitest";
import { Group } from "zarrita";
import { createSourceData } from "../../src/io";
import { openZarrRoot } from "../../src/services/http";

/**
 * Cloud storage URIs, opened end to end against real buckets.
 *
 * The mapping itself is pinned down offline in `tests/cloud-uri.test.ts`; what cannot be
 * settled there is whether the url the mapping produces is one a public bucket actually
 * answers. That is a claim about Amazon, Google and whoever runs the endpoint, so it is
 * made here, where a third party being slow or down cannot turn a pull request red.
 *
 * Two kinds of case, because they exercise different halves of the resolver: a bare
 * `s3://` URI, which has to have an endpoint supplied for it, and an `s3+https://` URI,
 * which brings one.
 */

/** An OME-NGFF group inside a public AWS bucket, addressed the way the AWS CLI would. */
const AWS_IMAGE = "s3://janelia-cosem-datasets/jrc_hela-2/jrc_hela-2.zarr/recon-1/em/fibsem-uint8";

/** IDR, which is S3-compatible and not Amazon, so the endpoint has to come from the URI. */
const COMPATIBLE_IMAGE = "s3+https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0062A/6001240.zarr";

test("an s3:// URI opens against Amazon's endpoint", async () => {
  expect(await openZarrRoot(AWS_IMAGE)).toBeInstanceOf(Group);
});

test("an s3+https:// URI opens against the endpoint it names", async () => {
  expect(await openZarrRoot(COMPATIBLE_IMAGE)).toBeInstanceOf(Group);
});

test("an image loads from a cloud URI as it would from an https url", async () => {
  // Through `createSourceData` rather than `openZarrRoot`, because opening the group only
  // shows that the metadata was reachable. This is what says the arrays behind it are
  // reachable too, which is the part a resolved url could get subtly wrong -- a mapping
  // that worked for the group and not for its chunks would pass the test above.
  const [fromUri] = await createSourceData({ source: COMPATIBLE_IMAGE });
  const [fromUrl] = await createSourceData({
    source: "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0062A/6001240.zarr",
  });
  expect(fromUri.axis_labels).toEqual(fromUrl.axis_labels);
  expect(fromUri.loader.length).toBe(fromUrl.loader.length);
});
