import { Box } from "@mui/material";
import { useAtomValue } from "jotai";
import * as React from "react";
import { hasScreenOrientation, resolveScreenOrientation } from "../orientation";
import { panelInsetAtom, sourceInfoAtom } from "../state";
import { tokens } from "../theme";
import { Arm } from "./OrientationArrow";

/**
 * RFC-4 anatomical orientation, as a legend in the corner of the view.
 *
 * The RFC asks an application to "display the encoded information with, for example,
 * the human-readable names of the axes along the rendered axes of the image", which is
 * all this does: it annotates the view and never moves a pixel. Which term goes on
 * which side is worked out in `../orientation`, through the image's model matrix, so a
 * transform that mirrors the image carries its labels with it.
 *
 * A corner rather than all four margins. The terms are long words -- `anterior`,
 * `posterior` -- and set against the edges they cost real room on a small viewport and
 * read as four unrelated captions rather than one statement about the image.
 *
 * Only the axes lying in the plane of the view appear here. An axis pointing at the
 * viewer has no direction to draw on a flat compass, and is on its slider instead.
 *
 * Read from the first source, as the scale bar is. Several images at once can disagree
 * about orientation, and a single frame of reference cannot honestly describe them.
 */

const SIZE = 46;
const CENTRE = SIZE / 2;
const ARM = 15;

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

  // A plate or a well is several subjects at once, which RFC-4 excludes: it applies
  // only where "there is a single subject in the acquired volume".
  if (source?.loaders || !hasScreenOrientation(orientation)) {
    return null;
  }

  const { edges } = orientation;

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        // Clear of the controls panel, so the legend is never read against it.
        left: panelInset,
        bottom: 0,
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
        // Beneath the panel and the toolbar, which are the things a user reaches for.
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
        {/* Only the arms with something to say: an image that orients one in-plane axis
            gets a double-headed arrow, not a cross with two blank ends. */}
        {edges.top && <Arm cx={CENTRE} cy={CENTRE} length={ARM} direction="up" />}
        {edges.bottom && <Arm cx={CENTRE} cy={CENTRE} length={ARM} direction="down" />}
        {edges.left && <Arm cx={CENTRE} cy={CENTRE} length={ARM} direction="left" />}
        {edges.right && <Arm cx={CENTRE} cy={CENTRE} length={ARM} direction="right" />}
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
