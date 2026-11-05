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

const sources = ["https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0062A/6001240.zarr"];

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
viewer.addImage({ source: "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.4/idr0062A/6001240.zarr" });
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

## Stores that are not open to the world

A store behind access control is read by supplying a `credentials` function. It is asked
what to send before every request, and asked again with `retry: true` if one is refused,
so a token that expires mid-session can be replaced without reloading.

```tsx
<Vizarr
  sources={["https://storage.googleapis.com/private-bucket/image.zarr"]}
  credentials={async ({ retry }) => ({
    headers: { Authorization: `Bearer ${await token({ refresh: retry })}` },
  })}
/>
```

`createViewer` takes the same function as an option:

```js
const viewer = await createViewer(element, { credentials });
```

Return `{ credentials: "include" }` to send a session cookie the browser already holds,
or `{}` where nothing needs to be carried at all — a bucket restricted by IP address, or
a URL that arrived with a signed query string already attached, which is copied onto
every request it makes.

Four things worth knowing before you rely on it:

- **It reaches the image only.** The table and ROI plugins build their own stores and do
  not yet see this function, so a private store will render as an image while its tables
  and ROIs fail.
- **A zipped store reads the credential once.** `ZipFileStore` takes no per-request
  options, so a token that expires mid-session will not be refreshed for one.
- **A reference store covers the spec, not the chunks.** The JSON is fetched with the
  credential; the chunk URLs named inside it are fetched by the store against whatever
  origins they point at.
- **Whatever you return, the user can read.** Vizarr runs entirely in the browser, so
  hand it a short-lived, narrow credential — never a cloud secret key, and never a token
  you would mind seeing in devtools. Keep it in memory rather than `localStorage`, which
  any script on the origin can read.
- **Check the url before answering.** The function is given the absolute url of every
  request precisely so it can decline: a viewer showing several images, or reading a
  reference store that names third-party origins, would otherwise send one server's
  credential to another. Return `{}` for anything you do not recognise.

```ts
const credentials = ({ url }) =>
  new URL(url).origin === "https://storage.googleapis.com" ? { headers } : {};
```

Reading across origins also needs the server's CORS configuration to allow whatever you
send. An `Authorization` header must appear in `Access-Control-Allow-Headers`, and a
sharded store issues range requests, so `Range` must be allowed too — otherwise the
failure arrives as a CORS error that looks nothing like an authentication problem.

## What to read next

- {@link VizarrViewerProps} — every property the component takes.
- {@link ImageLayerConfig} — the per-image options `createViewer`'s `addImage` accepts.
- {@link CredentialProvider} — the signature of the `credentials` function.
