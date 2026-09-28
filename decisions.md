# Time-lapse viewer — decisions

## Scope
- Separate opt-in mode: `?timelapse=1`. Without it, vizarr behaves exactly as before.
- Multiscale images only (no plates).
- OME-Zarr 0.4 (Zarr v2, whole chunks) and >= 0.5 (Zarr v3, whole shards). 0.4 not yet verified in a browser.

## User path
- Pick level → pre-load → navigate / play.
- The T slider and Play appear only after pre-load has finished.

## Level picker
- Shows each level's full uncompressed size (all t/z/c) as "≤ N MB".
- Hides levels above a 1 GB cap; defaults to the lowest resolution.

## Pre-load
- Downloads every stored object of the level (every shard; every chunk if unsharded) into memory.
- Progress is live: bytes are counted as shards stream in (polled 4×/s, not re-rendered per chunk), shown as shards · MB/estimated MB · MB/s · time left, with a progress bar. Estimate = average Content-Length so far × shard count.
- 4 downloads at a time, leaving browser connections free for the rest of the viewer.
- A failed shard is retried once; if it still fails, pre-load stops and the panel shows the error.
- Only one level is held in memory at a time; pre-loading another level replaces it.
- After download, every t at the current z/c is decoded into memory ("decoding X/N frames"); navigation is enabled only then.

## Rendering
- Always pinned to the pre-loaded level, drawn as one un-tiled image (no pin toggle).
- All reads of that level are served from memory: no network while scrubbing or playing.
- Late responses for an older t are dropped, so the view always matches the slider.

## Playback
- Play/Pause toggle and a restart (to t=0) button; fps control, default 2 fps.
- Play stops at the last t; pressing Play at the end restarts from 0.
- Scrubbing the T slider updates the view live.
- Elapsed time since t=0 (t × time-axis scale from the OME-Zarr metadata) is shown top-right as HH:MM:SS.s; unknown units show as "value unit".

## Learnings
- Tiled rendering mixes tiles from different t/levels during playback; un-tiled frames avoid this.
- Over HTTP/1.1 (6 connections), pre-load cost is request count × latency, not bytes; whole shards cut requests.
- Failed/aborted fetches must not be cached.
- Byte ranges served from memory must be copies, not subarrays: zarrita reads the shard index as BigUint64Array, which needs 8-byte alignment (this broke rendering silently).
- Play timer must not be reset by unrelated re-renders (vizarr's Viewer re-renders in a loop: "Maximum update depth exceeded", pre-existing).
- The earlier per-plane pre-load stalled (37/326 planes) and was replaced by the whole-level download.

## Open
- Verified in headless Chrome (EBI dataset, level 2): download, decode, play, slider; 0 network requests after ready.
- 1 GB cap and concurrency 4 are fixed guesses.
- Example: EBI NGFF challenge dataset c0e5d621-62cc-43a6-9dad-2ddab8959d17.zarr (T=163, 2 channels).
