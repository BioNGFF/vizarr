---
title: OME-NGFF RFCs
children:
  - ./rfc-4-axis-orientation.md
---

[OME-NGFF](https://ngff.openmicroscopy.org/) evolves through RFCs: proposals that add to
the format, each with its own status, review history and adoption timetable. An RFC being
accepted does not mean a viewer reads it, and a viewer reading it does not mean it reads
all of it.

These pages say, for each RFC, what vizarr does with the metadata — including where it
deliberately departs from the specification, and what it does not do at all.

## Support

| RFC | Title | RFC status | Vizarr |
| --- | --- | --- | --- |
| [4](./rfc-4-axis-orientation.md) | Axis Orientation | Accepted | In progress |

An RFC missing from this table has not been assessed, which is not the same as not being
supported. Some of what the RFCs describe has been in vizarr since before the RFC process
existed.

## How to read a status

**Vizarr** describes the viewer, not the format:

- **Supported** — the metadata is read and acted on. The page says what "acted on" means,
  because it is rarely everything the specification permits.
- **In progress** — being implemented. The page says how far it has got.
- **Read, not shown** — the metadata survives parsing and is available through the API,
  but nothing in the interface uses it.
- **Not supported** — the metadata is ignored. An image carrying it still opens; vizarr
  does not refuse images over metadata it does not understand.
- **Won't support** — a deliberate decision, with the reason on the page.

A status is about the current release. Where something is only on `dev`, the page says so.
