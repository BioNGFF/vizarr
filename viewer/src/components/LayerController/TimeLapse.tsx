import { Button, Divider, Grid, MenuItem, Select, TextField, Typography } from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import * as React from "react";
import { useLayerState, useSourceData } from "../../hooks";
import { setTSliceAtom } from "../../state";
import { MAX_BYTES, decodeAll, levelBytes, preload, timelapseFamily, timelapseModeAtom } from "../../timelapse";

function TimeLapse() {
  const mode = useAtomValue(timelapseModeAtom);
  const [layer] = useLayerState();
  const [sourceData] = useSourceData();
  const tAxis = sourceData.axis_labels.indexOf("t");
  const nT = tAxis === -1 ? 0 : sourceData.loader[0].shape[tAxis];
  if (!mode || layer.kind !== "multiscale" || nT < 2) return null;
  return <Panel tAxis={tAxis} nT={nT} />;
}

function Panel({ tAxis, nT }: { tAxis: number; nT: number }) {
  const [layer] = useLayerState();
  const [sourceData] = useSourceData();
  const [tl, setTl] = useAtom(timelapseFamily(sourceData.id));
  const setT = useSetAtom(setTSliceAtom);
  const { loader } = sourceData;
  const { selections } = layer.layerProps;
  const t = selections[0]?.[tAxis] ?? 0;

  const levels = loader.map((source, i) => ({ i, bytes: levelBytes(source) })).filter((l) => l.bytes <= MAX_BYTES);
  const [level, setLevel] = React.useState(loader.length - 1); // lowest resolution

  const onPreload = async () => {
    tl.controller?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    const update = (patch: Partial<typeof tl> | ((prev: typeof tl) => Partial<typeof tl>)) =>
      setTl((prev) =>
        prev.controller === controller ? { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) } : prev,
      );
    const tick = () => update((prev) => ({ loaded: prev.loaded + 1 }));
    setPlaying(false);
    setTl({ level, phase: "downloading", loaded: 0, total: 0, controller });
    try {
      await preload(loader[level], (total) => update({ total }), tick, signal);
      update({ phase: "decoding", loaded: 0, total: nT });
      await decodeAll(loader[level], selections, tAxis, nT, tick, signal);
      update({ phase: "ready" });
    } catch (err) {
      if (!signal.aborted) update({ phase: "error", error: String((err as Error)?.message ?? err) });
    }
  };

  // Play: one interval per play session; t is read from a ref so re-renders never reset the timer.
  const [playing, setPlaying] = React.useState(false);
  const [fps, setFps] = React.useState(2);
  const ready = tl.phase === "ready";
  const tRef = React.useRef(t);
  tRef.current = t;
  React.useEffect(() => {
    if (!playing || !ready) return;
    const id = setInterval(() => {
      const next = tRef.current + 1;
      if (next >= nT) return setPlaying(false); // stop at the end
      tRef.current = next;
      setT(next);
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [playing, ready, fps, nT, setT]);
  const onPlay = () => {
    if (playing) return setPlaying(false);
    if (t + 1 >= nT) setT(0); // at the end: restart from the start
    setPlaying(true);
  };

  const status = {
    idle: "",
    downloading: `downloading ${tl.loaded}/${tl.total} shards`,
    decoding: `decoding ${tl.loaded}/${tl.total} frames`,
    ready: `ready: ${nT} frames`,
    error: tl.error,
  }[tl.phase];

  return (
    <>
      <Grid container direction="column" spacing={0.5} sx={{ py: 0.5 }}>
        <Typography variant="caption">time-lapse:</Typography>
        <Grid container spacing={0.5} alignItems="center">
          <Select size="small" variant="standard" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {levels.map(({ i, bytes }) => (
              <MenuItem key={i} value={i}>
                <Typography variant="caption">
                  level {i} (≤ {Math.ceil(bytes / 1024 ** 2)} MB)
                </Typography>
              </MenuItem>
            ))}
          </Select>
          <Button size="small" onClick={onPreload} disabled={!levels.some((l) => l.i === level)}>
            pre-load
          </Button>
        </Grid>
        {tl.level !== null && (
          <Typography variant="caption">
            level {tl.level}: {status}
          </Typography>
        )}
        {ready && (
          <Grid container spacing={0.5} alignItems="center">
            <Button size="small" variant="outlined" onClick={onPlay}>
              {playing ? "pause" : "play"}
            </Button>
            <TextField
              size="small"
              variant="standard"
              type="number"
              label="fps"
              value={fps}
              onChange={(e) => setFps(Math.min(60, Math.max(0.1, Number(e.target.value) || 2)))}
              sx={{ width: 50 }}
            />
          </Grid>
        )}
      </Grid>
      <Divider />
    </>
  );
}

export default TimeLapse;
