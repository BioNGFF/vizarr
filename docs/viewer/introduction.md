---
title: Quick start
---


### Getting started

## Installation


```
npm install @hms-dbmi/vizarr
```

## Basic Usage

```
import VizarrViewer from '@hms-dbmi/vizarr'

function App() {

const sources = ["https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr"]

return(
  <VizarrViewer
    sources={sources}
    viewState={viewState}
/>
)
}


```
