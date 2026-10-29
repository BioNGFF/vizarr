import { Box, Divider, Input, Slider, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { styled } from "@mui/material/styles";
import type React from "react";

import { tokens } from "../../theme";

/** Group heading, matching the "Spatial Controls" label on the panel itself. */
export const sectionLabelSx: SxProps<Theme> = {
  color: "text.secondary",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

/** Slider sized to the panel's row height. Callers override `color` per channel. */
export const DenseSlider = styled(Slider)({
  color: "#fff",
  // Inset from both ends of its column: the thumb is a circle centred on the end of the
  // track, so at the minimum or maximum it overhangs the column and the row reads as
  // sticking out past the overflow buttons, section rules and panel edge around it.
  //
  // Width rather than margin. MUI gives the slider root `width: 100%` with
  // `box-sizing: content-box`, so a margin makes it overflow instead of shrinking it —
  // the `marginRight: 4` this replaces had no effect at all.
  marginLeft: "12px",
  width: "calc(100% - 24px)",
});

/** Numeric field in the option popovers. */
export const DenseInput = styled(Input)({
  width: "5.5em",
});

/** Toggle that should read as an inline control rather than a button. */
export const inlineIconButtonSx: SxProps<Theme> = {
  backgroundColor: "transparent",
  padding: 0,
  // Keeps the marker above the slider track it sits alongside.
  zIndex: 2,
};

/**
 * Option popover body. These float over the image rather than sitting inside the panel,
 * so they need their own outline and breathing room: previously they had 4px of
 * horizontal padding, no border and no radius, and read as a bare rectangle.
 */
export const popoverPaperSx: SxProps<Theme> = {
  p: 1.25,
  border: `1px solid ${tokens.panel.border}`,
  borderRadius: `${tokens.panel.radius}px`,
  // Paper lays an elevation gradient over its background in dark mode, which
  // lightens it away from the token; the surface should be exactly the token colour.
  backgroundImage: "none",
};

/** Menu surface. Same outline as a popover, but the items supply their own padding. */
export const menuPaperSx: SxProps<Theme> = {
  border: `1px solid ${tokens.panel.border}`,
  borderRadius: `${tokens.panel.radius}px`,
  // Paper lays an elevation gradient over its background in dark mode, which
  // lightens it away from the token; the surface should be exactly the token colour.
  backgroundImage: "none",
};

/** Select in the panel. Left at the theme's small size rather than shrunk further. */
export const denseSelectSx: SxProps<Theme> = { fontSize: "0.8rem" };

/**
 * Section heading with the rule running out from the label rather than sitting above or
 * below it, so the label reads as part of the separator.
 * `action` sits after the rule, for section-level controls such as "add channel".
 */
export function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.25 }}>
      <Typography variant="caption" sx={sectionLabelSx}>
        {children}
      </Typography>
      <Divider sx={{ flex: 1 }} />
      {action}
    </Box>
  );
}

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
