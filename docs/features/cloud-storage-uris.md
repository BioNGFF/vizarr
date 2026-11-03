---
title: Cloud storage URIs
---

Object storage is addressed with a URI nearly everywhere outside a browser: `s3://` in the
AWS CLI, boto3, fsspec and Spark, `gs://` for Google Cloud Storage. Vizarr accepts those
URIs as a source and resolves them to the HTTPS URLs a browser can actually fetch.

## Status

| | |
| --- | --- |
| **Vizarr** | Supported on `dev`, not yet in a release. |
| **Tracked in** | [#165](https://github.com/BioNGFF/vizarr/issues/165) |

## The forms it accepts

| URI | Resolves to | For |
| --- | --- | --- |
| `s3://bucket/key` | `https://bucket.s3.amazonaws.com/key` | Amazon S3 |
| `s3+https://endpoint/bucket/key` | `https://endpoint/bucket/key` | Any S3-compatible server |
| `s3+http://endpoint/bucket/key` | `http://endpoint/bucket/key` | A local MinIO, or anything else over plain HTTP |
| `gs://bucket/key` | `https://storage.googleapis.com/bucket/key` | Google Cloud Storage |

They work anywhere a source URL does — the `source` parameter, the URL box, a table passed
to the AnnData plugin, an ROI table — and a zipped store is resolved the same way, so
`s3://bucket/image.zarr.zip` is read with range requests like any other zip.

```
https://biongff.github.io/vizarr/?source=s3://janelia-cosem-datasets/jrc_hela-2/jrc_hela-2.zarr/recon-1/em/fibsem-uint8
https://biongff.github.io/vizarr/?source=s3+https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0062A/6001240.zarr
```

A vizarr link keeps whichever form you gave it. Resolution happens when a store is built,
not when a link is made, so a shared link stays readable by the tools that produced the
URI in the first place.

## There is no S3 protocol

This is worth being plain about, because it sounds like a shortcut and is not.

`s3://` is not a network protocol. S3's wire protocol *is* HTTPS — its API is a REST API —
and the URI is a naming convention the AWS CLI introduced. Every client that accepts one,
including boto3 and the CLI itself, parses it and issues an HTTPS request. Translation is
not vizarr declining to do the real thing; it is the real thing, in every client there is.

A browser could not do otherwise in any case. `fetch` has a fixed set of schemes and no
registry to extend, a service worker only ever sees `http(s)` requests, and
`registerProtocolHandler` is for navigation rather than fetching.

## What it cannot do

**Public buckets only.** There are no credentials in a page, so every request is anonymous.
A private bucket, or a requester-pays bucket, cannot be read this way. Where data needs
credentials, the usual answer is a presigned URL generated elsewhere and pasted in as an
ordinary `https://` source.

**CORS is the bucket owner's decision, not ours.** A browser will not let a page read a
bucket that does not return `Access-Control-Allow-Origin`, however public the bucket is.
Vizarr cannot work around it and neither can any other viewer in a tab. The bucket needs a
CORS policy allowing `GET` from the origin the viewer is served from; AWS documents
[how to set one](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html).

This is the most common reason a correct URI still fails, so the error message
distinguishes it from a URI vizarr could not understand at all.

**No `gcp://`.** It appears in enough documentation to be worth mentioning, but it is not a
scheme any Google tool emits. `gs://` is what gsutil, fsspec and the GCS documentation use,
and it is the one vizarr accepts.

**No Azure.** `az://container/path` and `abfs://` do not carry the storage account name,
which the HTTPS host needs, so they cannot be resolved from the URI alone. An Azure blob
URL works as an ordinary `https://` source.

## Why the bucket comes first in `s3+https://`

An S3-compatible endpoint can be addressed two ways — path-style, where the bucket is the
first path segment, and virtual-hosted, where the host itself is the bucket. Written as a
URI the two are indistinguishable: in `s3+https://host/a/b`, `a` could be a bucket or part
of a key.

[Neuroglancer](https://github.com/google/neuroglancer), which has the same scheme, documents
this ambiguity and resolves it by probing. Vizarr instead declares one reading:

> The first path segment after the host is always the bucket.

Nothing is lost by it. Where the host *is* the bucket, the plain `https://` URL already
works unchanged — `https://ome-zarr-rfc4.s3.filebase.io/ome-zarr/…` needs no scheme in
front of it — so there is nothing for an S3 URI to add in that case. Declaring the reading
removes both the ambiguity and the round trip it would otherwise cost.

The consequence is that the endpoint must accept path-style addressing. AWS, Filebase, the
EBI Embassy buckets and MinIO all do.

## Regions are deliberately absent

There is no region parameter and no way to name one, which is a decision rather than an
omission. A URI carries no region, and the global endpoint routes to the right one, whereas
a guess fails hard: `janelia-cosem-datasets` is served by `s3.amazonaws.com` and answers
with a 301 on `s3.us-west-2.amazonaws.com`, because despite the institute it belongs to the
bucket is in `us-east-1`.

## Testing

The mapping from URI to URL is pinned down offline, in `viewer/tests/cloud-uri.test.ts`,
and runs as part of:

```bash
pnpm test
```

What a mapping cannot settle is whether the url it produces is one a real bucket answers.
That claim is about Amazon, Google and whoever runs the endpoint, so it is made separately,
against public buckets on AWS and on the EBI Embassy:

```bash
pnpm test:remote
```

Those are opt-in and CI does not run them, because a third party being slow should not turn
a pull request red.

## References

- [Amazon S3 CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html)
- [Google Cloud Storage CORS configuration](https://cloud.google.com/storage/docs/cross-origin)
- [Neuroglancer's S3 key-value store](https://github.com/google/neuroglancer/blob/master/src/kvstore/s3/index.rst), whose URL syntax this follows
- [Vizarr issue #165](https://github.com/BioNGFF/vizarr/issues/165)
