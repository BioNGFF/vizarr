import ForwardIcon from "@mui/icons-material/Forward";
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type * as React from "react";
import type { OrientationEnds } from "../orientation";
import { tokens } from "../theme";

/**
 * The look of an RFC-4 anatomical term, wherever it is shown.
 *
 * One definition rather than two, so a term beside a slider reads as the same kind of
 * thing as a term at the edge of the image. They describe the same axis, and the only
 * reason they are drawn in different places is that one of the axes is pointing at the
 * viewer and cannot be labelled on the image at all.
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

export function OrientationLabel({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: Record<string, unknown>;
}) {
  return (
    <Box component="span" sx={{ ...LABEL_SX, ...sx }}>
      {children}
    </Box>
  );
}

/**
 * Both ends of an axis that points out of the view, with the direction between them.
 *
 * The arrow is drawn rather than typed, and solid rather than a thin stem: a glyph in
 * the middle of a caption sits on the text baseline and reads as punctuation, and a
 * hairline arrow at caption size is barely legible as an arrow at all. This is the one
 * part of the label whose whole job is to say *direction*, so it is the one part worth
 * making unmistakable.
 */
export function OrientationDirection({ ends }: { ends: OrientationEnds }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "3px", verticalAlign: "middle" }}>
      <OrientationLabel>{ends.from}</OrientationLabel>
      <ForwardIcon sx={{ fontSize: 20, opacity: 0.75 }} />
      <OrientationLabel>{ends.to}</OrientationLabel>
    </Box>
  );
}
