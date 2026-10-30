---
title: Quick start
---

Vizarr renders [OME-Zarr](https://ngff.openmicroscopy.org/) images in the browser. It
can be dropped into a React application as a component, or mounted into a page that is
not a React application at all.

## Installation

```bash
npm install @biongff/vizarr
```

React 18 and `react-dom` are peer dependencies, so the host application supplies them.

## As a React component

`Vizarr` fills the element it is placed in, so give that element a size.

```tsx
import { Vizarr } from "@biongff/vizarr";

const sources = ["https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240.zarr"];

export default function App() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Vizarr sources={sources} />
    </div>
  );
}
```

`sources` is a list, so several images can be shown at once, each with its own entry in
the controls panel. A plate or a well URL works here too: clicking a well opens it in
place, with a breadcrumb back out.

### Following the view

`onViewStateChange` reports the camera as the user pans and zooms, which is what you
need to keep a view in the URL or to drive a second viewer.

```tsx
import { Vizarr, type ViewState } from "@biongff/vizarr";

<Vizarr
  sources={sources}
  viewState={viewState}
  onViewStateChange={(next: ViewState) => setViewState(next)}
/>;
```

`viewState` is read when it changes, so passing back the value you were just given does
not fight the user for control of the camera.

### Sharing a theme

By default the viewer brings its own MUI theme. When the host already has a
`ThemeProvider`, pass `theme={null}` so the viewer inherits it instead of nesting a
second provider — otherwise the viewer and the UI around it resolve different themes and
quietly stop matching.

```tsx
<Vizarr sources={sources} theme={null} />
```

## Outside React

`createViewer` mounts a viewer into any element and returns a handle to drive it.

```js
import { createViewer } from "@biongff/vizarr";

const viewer = await createViewer(document.getElementById("root"));
viewer.addImage({ source: "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240.zarr" });
```

## Label images

A label image stored alongside its source is picked up on its own. One stored elsewhere
is passed in `labels`, positionally against `sources`:

```tsx
<Vizarr
  sources={["https://example.com/image.zarr"]}
  labels={["https://example.com/image-labels.zarr"]}
/>
```

## What to read next

- {@link VizarrViewerProps} — every property the component takes.
- {@link ImageLayerConfig} — the per-image options `createViewer`'s `addImage` accepts.
