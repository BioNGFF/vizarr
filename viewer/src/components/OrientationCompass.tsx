import { Box } from "@mui/material";
import { useAtomValue } from "jotai";
import * as React from "react";
import { hasScreenOrientation, resolveScreenOrientation } from "../orientation";
import { panelInsetAtom, sourceInfoAtom } from "../state";
import { tokens } from "../theme";

/**
 * RFC-4 orientation as a legend in the corner, rather than against the edges.
 *
 * The same information as `OrientationOverlay`, gathered into one place: a four-way
 * arrow with the term each direction leads to set around it. It costs a corner instead
 * of all four margins, which matters on a small viewport or beside a wide image, and it
 * reads as one object rather than four unrelated captions.
 *
 * Only the axes lying in the plane of the view appear here. An axis pointing at the
 * viewer has no direction to draw on a flat compass, and is on its slider instead.
 */

const SIZE = 46;
const CENTRE = SIZE / 2;
const ARM = 15;
const HEAD = 4.5;

/** One arm of the cross, drawn only where that direction has something to say. */
function Arm({ direction }: { direction: "up" | "down" | "left" | "right" }) {
  const tip = {
    up: [CENTRE, CENTRE - ARM],
    down: [CENTRE, CENTRE + ARM],
    left: [CENTRE - ARM, CENTRE],
    right: [CENTRE + ARM, CENTRE],
  }[direction];

  const head = {
    up: `${CENTRE},${CENTRE - ARM - HEAD} ${CENTRE - HEAD},${CENTRE - ARM + 1} ${CENTRE + HEAD},${CENTRE - ARM + 1}`,
    down: `${CENTRE},${CENTRE + ARM + HEAD} ${CENTRE - HEAD},${CENTRE + ARM - 1} ${CENTRE + HEAD},${CENTRE + ARM - 1}`,
    left: `${CENTRE - ARM - HEAD},${CENTRE} ${CENTRE - ARM + 1},${CENTRE - HEAD} ${CENTRE - ARM + 1},${CENTRE + HEAD}`,
    right: `${CENTRE + ARM + HEAD},${CENTRE} ${CENTRE + ARM - 1},${CENTRE - HEAD} ${CENTRE + ARM - 1},${CENTRE + HEAD}`,
  }[direction];

  return (
    <>
      <line x1={CENTRE} y1={CENTRE} x2={tip[0]} y2={tip[1]} stroke="currentColor" strokeWidth={1.25} />
      <polygon points={head} fill="currentColor" />
    </>
  );
}

const term = {
  fontSize: 10,
  lineHeight: 1.2,
  letterSpacing: "0.04em",
  textTransform: "lowercase" as const,
  whiteSpace: "nowrap" as const,
  color: "rgba(255, 255, 255, 0.85)",
};

function OrientationCompass() {
  const sources = useAtomValue(sourceInfoAtom);
  const panelInset = useAtomValue(panelInsetAtom);
  const source = sources[0];

  const orientation = React.useMemo(
    () => resolveScreenOrientation(source?.axes, source?.model_matrix),
    [source?.axes, source?.model_matrix],
  );

  // As the edge labels are: a plate or a well is several subjects at once, which RFC-4
  // excludes.
  if (source?.loaders || !hasScreenOrientation(orientation)) {
    return null;
  }

  const { edges } = orientation;

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        left: panelInset,
        bottom: 0,
        // Clear of the panel, and of the edge labels at the left and bottom.
        margin: "16px 0 16px 16px",
        padding: "6px 10px 8px",
        background: tokens.panel.background,
        border: `1px solid ${tokens.panel.inset}`,
        borderRadius: `${tokens.panel.radius}px`,
        display: "grid",
        // The arrow in the middle, a term on each side of it.
        gridTemplateColumns: "auto auto auto",
        gridTemplateRows: "auto auto auto",
        alignItems: "center",
        justifyItems: "center",
        columnGap: "6px",
        zIndex: 0,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <Box />
      <Box sx={term}>{edges.top}</Box>
      <Box />

      <Box sx={term}>{edges.left}</Box>
      <Box
        component="svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        sx={{ width: SIZE, height: SIZE, color: "rgba(255, 255, 255, 0.6)", display: "block" }}
      >
        {edges.top && <Arm direction="up" />}
        {edges.bottom && <Arm direction="down" />}
        {edges.left && <Arm direction="left" />}
        {edges.right && <Arm direction="right" />}
        <circle cx={CENTRE} cy={CENTRE} r={1.75} fill="currentColor" />
      </Box>
      <Box sx={term}>{edges.right}</Box>

      <Box />
      <Box sx={term}>{edges.bottom}</Box>
      <Box />
    </Box>
  );
}

export default OrientationCompass;
