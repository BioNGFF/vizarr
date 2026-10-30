<h1 align="center">
  <img src="./assets/logo-wide.svg" alt="vizarr" width="200">
</h1>

<p align="center">
  <samp>view multiscale OME-Zarr images online and in notebooks</samp>
</p>

<p align="center">
  <a href="https://biongff.github.io/vizarr/?source=https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr"><img src="https://img.shields.io/badge/demo-launch-27aae1" alt="demo"></a>
  <a href="https://storage.googleapis.com/vizarr/index.html"><img src="https://img.shields.io/badge/docs-view-27aae1" alt="docs"></a>
  <a href="https://www.npmjs.com/package/@biongff/vizarr"><img src="https://img.shields.io/npm/v/%40biongff%2Fvizarr" alt="npm"></a>
  <a href="https://codecov.io/gh/BioNGFF/vizarr"><img src="https://codecov.io/gh/BioNGFF/vizarr/graph/badge.svg" alt="coverage"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/BioNGFF/vizarr" alt="licence"></a>
</p>

<p align="center">
  <a href="https://github.com/BioNGFF/vizarr/actions/workflows/ci.yml"><img src="https://github.com/BioNGFF/vizarr/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/BioNGFF/vizarr/actions/workflows/release.yml"><img src="https://github.com/BioNGFF/vizarr/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="https://github.com/BioNGFF/vizarr/actions/workflows/publish-npm.yml"><img src="https://github.com/BioNGFF/vizarr/actions/workflows/publish-npm.yml/badge.svg" alt="Publish to npm"></a>
</p>

**Vizarr** is a minimal, purely client-side viewer for Zarr-based images, with
particular support for [OME-Zarr](https://ngff.openmicroscopy.org/). It renders in the
browser with no server of its own.

- ⚡ GPU accelerated rendering with [Viv](https://github.com/hms-dbmi/viv)
- 💻 Purely client-side Zarr access with [zarrita.js](https://github.com/manzt/zarrita.js)
- 🔬 Images, plates, wells and labels, from OME-NGFF v0.1 to v0.6
- 📦 Any `zarr-python` [store](https://zarr.readthedocs.io/en/stable/user-guide/storage.html) as a backend

<p align="center">
  <img src="./assets/screenshot.png" alt="Multiscale OME-Zarr in a Jupyter notebook" width="500">
</p>

## Use it

### In the browser

Pass a Zarr store URL as the `?source` query parameter to the
[web app](https://biongff.github.io/vizarr):

```
https://biongff.github.io/vizarr/?source=https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr
```

### In a React application

```bash
npm install @biongff/vizarr
```

```tsx
import { Vizarr } from "@biongff/vizarr";

<Vizarr sources={["https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr"]} />
```

There is a non-React entry point too, and plugins for
[tables](./anndata-zarr) and [regions of interest](./roi-selector). The
[API documentation](https://storage.googleapis.com/vizarr/index.html) covers all three
packages.

### In a notebook

The Python API is an [anywidget](https://github.com/manzt/anywidget), so it works in
Jupyter, JupyterLab, Colab and VS Code.

```python
import vizarr
import zarr

viewer = vizarr.Viewer()
viewer.add_image(zarr.open("./path/to/ome.zarr"))
viewer
```

See the [getting started](./python/notebooks/getting_started.ipynb) notebook, or
[open the Mandelbrot example in Colab](https://colab.research.google.com/github/BioNGFF/vizarr/blob/main/python/notebooks/mandelbrot.ipynb).

## What it can display

Vizarr shows 2D slices of n-dimensional Zarr arrays, as a single channel or a blended
composite. Viv supports `int8`, `int16`, `int32`, `uint8`, `uint16`, `uint32`,
`float32` and `float64`.

It was built for viewing multiple pyramidal OME-Zarr images together, and that case is
the best tested. Generic Zarr arrays work but are exercised less; the example notebooks
cover them.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setting up a development environment, and
[CLAUDE.md](./CLAUDE.md) for how the repository is organised.

This is [BioNGFF](https://github.com/BioNGFF)'s fork of
[hms-dbmi/vizarr](https://github.com/hms-dbmi/vizarr).

## Citation

If you use Vizarr in your research, please cite:

> Trevor Manz, Ilan Gold, Nathan Heath Patterson, Chuck McCallum, Mark S Keller, Bruce W Herr II, Katy Börner, Jeffrey M Spraggins, Nils Gehlenborg,
> "[Viv: multiscale visualization of high-resolution multiplexed bioimaging data on the web](https://www.nature.com/articles/s41592-022-01482-7)."
> **Nature Methods** (2022), [doi:10.1038/s41592-022-01482-7](https://doi.org/10.1038/s41592-022-01482-7)
