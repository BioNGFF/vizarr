import { Input, Slider, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { styled } from "@mui/material/styles";
import type React from "react";

/**
 * Shared styling for the controls panel's rows, so the sections inside it read as one
 * set of controls. Several of these were previously duplicated verbatim across files,
 * or written as inline styles that bypassed the theme.
 */

/** Group heading, matching the "Spatial Controls" label on the panel itself. */
export const sectionLabelSx: SxProps<Theme> = {
  color: "text.secondary",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

/** Slider sized to the panel's row height. Callers override `color` per channel. */
export const DenseSlider = styled(Slider)({
  color: "#fff",
  padding: "10px 0 5px 0",
  marginRight: 5,
});

/** Numeric field in the option popovers. */
export const DenseInput = styled(Input)({
  width: "5.5em",
  fontSize: "0.7em",
});

/** Toggle that should read as an inline control rather than a button. */
export const inlineIconButtonSx: SxProps<Theme> = {
  backgroundColor: "transparent",
  padding: 0,
  // Keeps the marker above the slider track it sits alongside.
  zIndex: 2,
};

/** Option popover body. The theme paints the surface; this is only spacing. */
export const popoverPaperSx: SxProps<Theme> = { px: 0.5, mb: 0.5 };

/** Select scaled to the panel's dense type. */
export const denseSelectSx: SxProps<Theme> = { fontSize: "0.7em" };

/**
 * Row label that truncates to whatever width the row gives it. This replaced a
 * hardcoded 165px, which dated from when the panel was sized by its content and
 * truncated names early now that the panel is 250/300px wide.
 */
export function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      noWrap
      sx={{ display: "block", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
    >
      {children}
    </Typography>
  );
}
