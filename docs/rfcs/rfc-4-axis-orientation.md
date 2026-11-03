---
title: "RFC-4: Axis Orientation"
---

[RFC-4](https://ngff.openmicroscopy.org/rfc/4/index.html) lets a spatial axis say which
anatomical direction it runs in, so a viewer can tell a reader which side of a brain scan
is left without them having to know how the file was written.

## Status

| | |
| --- | --- |
| **RFC** | Accepted (S1, SPEC updates). Last changed 2026-09-01. |
| **Vizarr** | In progress. The reader carries orientation through ([#163](https://github.com/BioNGFF/vizarr/pull/163)) and the viewer draws it ([#164](https://github.com/BioNGFF/vizarr/pull/164)); neither has reached `dev`. |
| **Tracked in** | [#158](https://github.com/BioNGFF/vizarr/issues/158) |

Images carrying orientation open normally today — the metadata is simply ignored.

## What RFC-4 adds

One optional field on each spatial axis:

```json
{
  "name": "x",
  "type": "space",
  "unit": "millimeter",
  "orientation": { "type": "anatomical", "value": "right-to-left" }
}
```

`type` is `"anatomical"`, which is the only domain the RFC defines. `value` is one of 24
direction pairs — `left-to-right`, `anterior-to-posterior`, `superior-to-inferior`,
`rostral-to-caudal`, `dorsal-to-palmar`, `superficial-to-deep`, `apex-to-base`, and the
reverse of each.

A value names the direction **from the axis's lowest coordinate to its highest**. So
`anterior-to-posterior` means coordinates increase towards the back. That is a statement
about the coordinate system the spatial metadata establishes, not about array index
order, which is why it composes with `coordinateTransformations` rather than contradicting
them: a negative scale is already accounted for by the time orientation is read.

Two constraints bound where it can appear. It may only be used on axes of type `space`,
and only where the image holds a single subject roughly aligned to the imaging axes — so
it is not meaningful per well in a plate.

## What vizarr will do with it

**Annotate the view; never move a pixel.**

The tempting reading is that RFC-4 lets a viewer show a brain the right way round, and so
it should reorient images to a canonical frame. Vizarr will not, for four reasons:

1. The RFC does not ask for it. Its only instruction to applications is to *display the
   encoded information*, with axis names along the rendered axes or an orientation widget.
2. Orientation and the coordinate transformations compose rather than conflict, so
   treating orientation as an instruction to flip would apply the flip twice.
3. Vizarr renders a single plane through an orthographic camera. At most two of the three
   oriented axes are ever on screen, so there is no canonical 3D view to reorient to.
4. A display flip would change the world coordinates that the ROI plugin and host
   applications read, silently invalidating every stored region.

What that means in practice:

- **Axes in the plane of the view** go on a compass in the bottom-left corner: a four-way
  arrow with the term each direction leads to set around it. Which side gets which term is
  computed through the image's model matrix rather than from axis order, since a transform
  can already rotate or flip the image. Only the arms with something to say are drawn, so
  an image that annotates one in-plane axis gets a double-headed arrow rather than a cross
  with two blank ends.
- **Axes through the plane** — usually z — have no direction to draw on a flat legend, so
  they go on the slider that scrolls through them, ordered the way the handle travels. The
  arrow is the compass's, drawn from one definition, because the two are saying the same
  thing about different axes.
- **Missing orientation** is reported rather than assumed. The RFC permits a viewer to
  assume a default but asks it to warn; vizarr warns and assumes nothing.

## Where vizarr departs from the specification

RFC-4 says orientation MUST NOT appear on a non-spatial axis. An image that breaks that
rule still opens in vizarr, with a warning.

This is deliberate. Refusing to display an image because one annotation is in the wrong
place serves nobody: the pixels are fine, and the reader is better off seeing them
alongside a note that the metadata is wrong. It follows the same principle as the rest of
the metadata layer, which prefers a warning to an error wherever an image can still be
drawn. The conformance corpus ships a case for exactly this
(`TC-D_orientation_on_time_axis`), and vizarr opens it.

A value outside the controlled vocabulary is treated differently: it fails the schema, and
the image does not open at all. The corpus case `TC-C_invalid_vocabulary` is unopenable in
vizarr today for that reason. This is accepted for now rather than defended — an enum is
the thing that makes the other 23 values trustworthy, and relaxing it would mean carrying a
value no part of the viewer knows what to do with. Revisiting it is tracked in
[#158](https://github.com/BioNGFF/vizarr/issues/158).

## Sample images

The RFC's reference implementation publishes a conformance corpus:
[fideus-labs/ome-zarr-rfc4-validation](https://github.com/fideus-labs/ome-zarr-rfc4-validation).
The images are mirrored to a public bucket that needs no credentials and sets permissive
CORS headers, so they can be opened directly in the viewer:

```
https://ome-zarr-rfc4.s3.filebase.io/ome-zarr/<name>.ome.zarr
```

Sixteen valid OME-Zarr cases, written as NGFF 0.5, using all 24 vocabulary terms between
them. A few worth knowing:

| Image | Orientation | Why it is interesting |
| --- | --- | --- |
| `brain_icbm_ras` | z inferior-to-superior · y posterior-to-anterior · x left-to-right | A full RAS brain; all three axes annotated |
| `mouse_allen_quadruped` | z rostral-to-caudal · y dorsal-to-ventral · x right-to-left | Quadruped vocabulary, which has no biped equivalent |
| `skin_janelia_superficial_deep` | z superficial-to-deep | Tissue-local orientation, with no whole-subject frame |
| `heart_sunnybrook_apex_base` | z apex-to-base | Organ-local orientation |
| `foot_cmb_limb` | z distal-to-proximal · y dorsal-to-plantar | An axis deliberately left unannotated |

Every case has a `_flip` twin carrying a reversed term over identical pixels. The pair is
the useful test: an implementation that reads orientation but labels the wrong end of the
axis looks correct on one and wrong on the other.

The twins are not all whole-image mirrors. `mouse_rosenhain_flip` reverses z and leaves y
as `dorsal-to-ventral`, because it exists to cover `cranial-to-caudal` in real data rather
than to mirror the image.

These are small single-resolution volumes — the largest is 132 × 80 × 114 — so they
exercise metadata and labelling, not tiling or pyramid behaviour.

## Conformance testing

The corpus is read by `viewer/tests/remote/rfc4-orientation.test.ts`, which is part of the
remote suite:

```bash
pnpm test:remote
```

It is remote, and not part of `pnpm test`, because the images come from a server the
project does not run. A third party being slow or down should not turn a pull request red.

It asserts that every case loads, that axis labels and rank are right, and that the
physical size unit is read where a case declares one. Separately it checks that the corpus
still declares the orientations recorded in the test, since third-party data changing
underneath a test would otherwise leave it passing for the wrong reason.

One thing it does not assert: `TC-C_invalid_vocabulary` is not opened, because it cannot
be. What the viewer draws from orientation is tested offline instead, in
`viewer/tests/orientation.test.ts`, against hand-written matrices — a negative scale, a
quarter turn, a reversed through-plane axis — rather than against real images, so the part
most likely to be subtly wrong does not depend on a network.

## References

- [RFC-4: Axis Orientation](https://ngff.openmicroscopy.org/rfc/4/index.html)
- [Reference validator and conformance suite](https://github.com/fideus-labs/ome-zarr-rfc4-validation)
- [ngff-zarr](https://ngff-zarr.readthedocs.io/en/latest/rfc4.html) — writes orientation,
  from the command line or Python
- [Vizarr issue #158](https://github.com/BioNGFF/vizarr/issues/158) — implementation
