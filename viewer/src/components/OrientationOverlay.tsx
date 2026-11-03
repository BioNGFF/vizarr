import { Box } from "@mui/material";
import { useAtomValue } from "jotai";
import * as React from "react";
import { hasScreenOrientation, resolveScreenOrientation } from "../orientation";
import { panelInsetAtom, sourceInfoAtom } from "../state";
import { tokens } from "../theme";

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
  const label = {
    position: "absolute" as const,
    color: "rgba(255, 255, 255, 0.85)",
    background: tokens.panel.background,
    border: `1px solid ${tokens.panel.inset}`,
    borderRadius: `${tokens.panel.radius / 2}px`,
    padding: "2px 7px",
    fontSize: 11,
    lineHeight: 1.4,
    letterSpacing: "0.04em",
    textTransform: "lowercase" as const,
    whiteSpace: "nowrap" as const,
    userSelect: "none" as const,
  };

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
      {edges.top && <Box sx={{ ...label, top: 8, left: "50%", transform: "translateX(-50%)" }}>{edges.top}</Box>}
      {edges.bottom && (
        <Box sx={{ ...label, bottom: 8, left: "50%", transform: "translateX(-50%)" }}>{edges.bottom}</Box>
      )}
      {edges.left && <Box sx={{ ...label, left: 8, top: "50%", transform: "translateY(-50%)" }}>{edges.left}</Box>}
      {edges.right && <Box sx={{ ...label, right: 8, top: "50%", transform: "translateY(-50%)" }}>{edges.right}</Box>}
    </Box>
  );
}

export default OrientationOverlay;
