import { Box } from "@mui/material";
import { useAtomValue } from "jotai";
import * as React from "react";
import { hasScreenOrientation, resolveScreenOrientation } from "../orientation";
import { panelInsetAtom, sourceInfoAtom } from "../state";
import { OrientationLabel } from "./OrientationLabel";

/**
 * RFC-4 anatomical orientation, written against the edges of the view.
 *
 * The RFC asks an application to "display the encoded information with, for example,
 * the human-readable names of the axes along the rendered axes of the image", which is
 * all this does: it annotates the view and never moves a pixel. Where the labels go is
 * worked out in `../orientation`, through the image's model matrix, so a transform that
 * mirrors the image carries its labels with it.
 *
 * Read from the first source, as the scale bar is. Several images at once can disagree
 * about orientation, and a single frame of reference cannot honestly describe them.
 */
/** Lifted out of the component so the four labels share one positioning rule. */
const EDGE = { position: "absolute" as const };

function OrientationOverlay() {
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
        // Clear of the controls panel, so a label is never read against it.
        left: panelInset,
        right: 0,
        top: 0,
        bottom: 0,
        // Beneath the panel and the toolbar, which are the things a user reaches for.
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      {edges.top && (
        <OrientationLabel sx={{ ...EDGE, top: 8, left: "50%", transform: "translateX(-50%)" }}>
          {edges.top}
        </OrientationLabel>
      )}
      {edges.bottom && (
        <OrientationLabel sx={{ ...EDGE, bottom: 8, left: "50%", transform: "translateX(-50%)" }}>
          {edges.bottom}
        </OrientationLabel>
      )}
      {edges.left && (
        <OrientationLabel sx={{ ...EDGE, left: 8, top: "50%", transform: "translateY(-50%)" }}>
          {edges.left}
        </OrientationLabel>
      )}
      {edges.right && (
        <OrientationLabel sx={{ ...EDGE, right: 8, top: "50%", transform: "translateY(-50%)" }}>
          {edges.right}
        </OrientationLabel>
      )}
    </Box>
  );
}

export default OrientationOverlay;
