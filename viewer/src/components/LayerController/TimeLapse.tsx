import { HelpOutline, PauseCircle, PlayCircle, Replay } from "@mui/icons-material";
import {
  Button,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Popover,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import * as React from "react";
import { useLayerState, useSourceData } from "../../hooks";
import { setTSliceAtom } from "../../state";
import {
  type DownloadProgress,
  MAX_BYTES,
  decodeAll,
  levelBytes,
  preload,
  timelapseFamily,
  timelapseModeAtom,
} from "../../timelapse";

const FPS = [1, 2, 5, 10, 24, 60];
const mb = (n: number) => (n / 1024 ** 2).toFixed(1);

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

  // Live download numbers: preload mutates `progress`; poll it a few times a second instead of
  // re-rendering on every network chunk.
  const progressRef = React.useRef<{ start: number; progress: DownloadProgress } | null>(null);
  const [bytes, setBytes] = React.useState({ received: 0, estimate: 0, rate: 0 });
  React.useEffect(() => {
    if (tl.phase !== "downloading") return;
    const id = setInterval(() => {
      const p = progressRef.current;
      if (!p) return;
      const { received, expected, started } = p.progress;
      const seconds = (performance.now() - p.start) / 1000;
      // content-length of shards seen so far, extrapolated to all shards
      const estimate = started ? Math.max(received, (expected / started) * tl.total) : 0;
      setBytes({ received, estimate, rate: received / Math.max(seconds, 0.001) });
    }, 250);
    return () => clearInterval(id);
  }, [tl.phase, tl.total]);

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
    const progress = { received: 0, expected: 0, started: 0 };
    progressRef.current = { ...progress, start: performance.now(), progress };
    try {
      await preload(loader[level], (total) => update({ total }), tick, signal, progress);
      update({ phase: "decoding", loaded: 0, total: nT });
      await decodeAll(loader[level], selections, tAxis, nT, tick, signal);
      update({ phase: "ready" });
    } catch (err) {
      if (!signal.aborted) update({ phase: "error", error: String((err as Error)?.message ?? err) });
    }
  };

  // Play: one interval per play session; t is read from a ref so re-renders never reset the timer.
  const [playing, setPlaying] = React.useState(false);
  const [fps, setFps] = React.useState(5);
  const ready = tl.phase === "ready";
  const tRef = React.useRef(t);
  tRef.current = t;
  React.useEffect(() => {
    if (!playing || !ready) return;
    const id = setInterval(() => {
      const next = (tRef.current + 1) % nT; // loop: after the last t, back to 0
      tRef.current = next;
      setT(next);
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [playing, ready, fps, nT, setT]);
  const onPlay = () => {
    setPlaying(!playing);
  };

  const status = {
    idle: "",
    downloading: [
      `${tl.loaded}/${tl.total} shards`,
      `${mb(bytes.received)}${bytes.estimate ? `/${mb(bytes.estimate)}` : ""} MB`,
      `${mb(bytes.rate)} MB/s`,
      bytes.rate && bytes.estimate ? `~${Math.ceil((bytes.estimate - bytes.received) / bytes.rate)} s left` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    decoding: `decoding ${tl.loaded}/${tl.total} frames`,
    ready: `ready: ${nT} frames`,
    error: tl.error,
  }[tl.phase];

  return (
    <>
      <Grid container direction="column" spacing={0.5} sx={{ py: 0.5 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Typography variant="caption">time-lapse:</Typography>
          <Help />
        </Grid>
        <Grid container spacing={0.5} alignItems="center" wrap="nowrap">
          <Select
            size="small"
            variant="standard"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            sx={{ flex: 1, minWidth: 0 }}
          >
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
        {(tl.phase === "downloading" || tl.phase === "decoding") && (
          <LinearProgress
            variant="determinate"
            value={
              tl.phase === "downloading"
                ? bytes.estimate
                  ? (100 * bytes.received) / bytes.estimate
                  : 0
                : (100 * tl.loaded) / Math.max(tl.total, 1)
            }
          />
        )}
        {/* always visible so the mode is discoverable; disabled (greyed) until a level is loaded */}
        <Tooltip title={ready ? "" : "pre-load needed for time-lapse"} followCursor>
          <Grid container alignItems="center" justifyContent="space-between" sx={{ opacity: ready ? 1 : 0.4 }}>
            <Tooltip title={ready ? "restart from t=0" : ""}>
              <IconButton size="small" aria-label="restart" onClick={() => setT(0)} disabled={!ready}>
                <Replay fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={ready ? (playing ? "pause" : "play") : ""}>
              <IconButton aria-label={playing ? "pause" : "play"} onClick={onPlay} sx={{ p: 0.25 }} disabled={!ready}>
                {playing ? <PauseCircle sx={{ fontSize: 36 }} /> : <PlayCircle sx={{ fontSize: 36 }} />}
              </IconButton>
            </Tooltip>
            <Select
              size="small"
              variant="standard"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              renderValue={(v) => <Typography variant="caption">{v} fps</Typography>}
              aria-label="frames per second"
              disabled={!ready}
            >
              {FPS.map((f) => (
                <MenuItem key={f} value={f}>
                  <Typography variant="caption">{f} fps</Typography>
                </MenuItem>
              ))}
            </Select>
          </Grid>
        </Tooltip>
      </Grid>
      <Divider />
    </>
  );
}

/** (?) icon explaining the mode; the load button alone didn't make it obvious. */
function Help() {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton size="small" aria-label="about time-lapse mode" onClick={(e) => setAnchor(e.currentTarget)}>
        <HelpOutline fontSize="inherit" />
      </IconButton>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Typography variant="caption" component="div" sx={{ p: 1.5, maxWidth: 260, lineHeight: 1.6 }}>
          Plays the image over time, smoothly.
          <br />
          1. Pick a resolution level (lower = faster, less memory).
          <br />
          2. Load it: the whole level is downloaded into memory once.
          <br />
          3. Then scrub T or press play; nothing is fetched while playing.
        </Typography>
      </Popover>
    </>
  );
}

export default TimeLapse;
