import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type * as React from "react";
import type { OrientationEnds } from "../orientation";
import { tokens } from "../theme";
import { InlineArrow } from "./OrientationArrow";

/**
 * The look of an RFC-4 anatomical term beside a slider.
 *
 * Set in a pill rather than as bare text, which is what the compass uses: there the
 * bordered box already separates the terms from everything around them, while here they
 * share a line with the axis name and its index and would otherwise read as part of it.
 */
const LABEL_SX: SxProps<Theme> = {
  display: "inline-block",
  color: "rgba(255, 255, 255, 0.85)",
  background: tokens.panel.background,
  border: `1px solid ${tokens.panel.inset}`,
  borderRadius: `${tokens.panel.radius / 2}px`,
  padding: "2px 7px",
  fontSize: 11,
  lineHeight: 1.4,
  letterSpacing: "0.04em",
  textTransform: "lowercase",
  whiteSpace: "nowrap",
  userSelect: "none",
};

function OrientationLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box component="span" sx={LABEL_SX}>
      {children}
    </Box>
  );
}

/**
 * Both ends of an axis that points out of the view, with the direction between them.
 *
 * The arrow is the compass's, so the two displays say the same thing the same way --
 * the only reason this axis is described here rather than on the compass is that it
 * points at the viewer and has no direction to draw on a flat legend.
 */
export function OrientationDirection({ ends }: { ends: OrientationEnds }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "4px", verticalAlign: "middle" }}>
      <OrientationLabel>{ends.from}</OrientationLabel>
      <InlineArrow />
      <OrientationLabel>{ends.to}</OrientationLabel>
    </Box>
  );
}
