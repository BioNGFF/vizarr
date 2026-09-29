import { useAtomValue } from "jotai";
import * as React from "react";
import { layerFamilyAtom, sourceInfoAtom } from "../state";
import { timelapseModeAtom } from "../timelapse";

const SECONDS: Record<string, number> = { millisecond: 0.001, second: 1, minute: 60, hour: 3600 };

function format(value: number, unit: string) {
  const perUnit = SECONDS[unit];
  if (perUnit === undefined) return `${+value.toFixed(3)} ${unit}`.trim();
  const s = value * perUnit;
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = (s % 60).toFixed(1).padStart(4, "0");
  return `${hh}:${mm}:${ss} (${+value.toFixed(1)} ${unit}s)`; // e.g. "00:03:53.7 (233.7 seconds)"
}

/** Time-lapse mode: elapsed time since t=0, from the OME-Zarr time axis scale. */
function Stamp({ source }: { source: ReturnType<typeof useAtomValue<typeof sourceInfoAtom>>[number] }) {
  const layer = useAtomValue(layerFamilyAtom(source));
  const step = source.loader[0].meta?.physicalSizes?.t;
  const tAxis = source.axis_labels.indexOf("t");
  if (!step || tAxis === -1) return null;
  const t = layer.layerProps.selections[0]?.[tAxis] ?? 0;
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        padding: "2px 8px",
        background: "rgba(0, 0, 0, 0.6)",
        color: "white",
        font: "16px monospace",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {format(t * step.size, step.unit)}
    </div>
  );
}

export default function TimeStamp() {
  const mode = useAtomValue(timelapseModeAtom);
  const [source] = useAtomValue(sourceInfoAtom);
  if (!mode || !source) return null;
  return <Stamp source={source} />;
}
