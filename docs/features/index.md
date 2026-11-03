---
title: Features
children:
  - ./cloud-storage-uris.md
---

Not everything vizarr does comes from an OME-NGFF RFC. Some of it is about reaching the
data at all — where an image can live, how it is addressed, what a browser is allowed to
fetch — and some of it is interface that no specification asks for.

These pages cover that half: what the viewer supports, what it deliberately does not, and
how to tell which of the two you have run into.

## In this section

| Page | What it covers |
| --- | --- |
| [Cloud storage URIs](./cloud-storage-uris.md) | Opening images addressed as `s3://`, `s3+https://` or `gs://` |

## How to read these pages

Each one says what the feature does, where it stops, and why it stops there. A limit with
a reason attached is more use than a feature list: most of what a reader needs to know
about reading images out of a bucket, for instance, is which failures are vizarr's fault
and which are the bucket's.

Where something is only on `dev` and not in a release, the page says so.
