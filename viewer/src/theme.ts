import { grey } from "@mui/material/colors";
import { createTheme } from "@mui/material/styles";

/**
 * Surface values that MUI's palette has no slot for, so that overlay panels and the
 * toolbar rail are defined once rather than repeated as literals at each use site.
 * Plugins should style their own panels from these so they match the viewer's chrome.
 */
export const tokens = {
  /** Floating panel laid over the image. */
  panel: {
    background: "rgba(0, 0, 0, 0.72)",
    border: "rgba(255, 255, 255, 0.38)",
    inset: "rgba(255, 255, 255, 0.18)",
    radius: 8,
  },
  /** Toolbar rail buttons, which sit directly on the image and need more contrast. */
  rail: {
    background: "#151515",
    border: "#2a2a2a",
    hover: "#232323",
    active: "#2f2f2f",
    radius: 8,
  },
  scrollbarThumb: "rgba(255, 255, 255, 0.22)",
} as const;

export default createTheme({
  palette: {
    mode: "dark",
    primary: { main: grey[500] },
    secondary: { main: grey[500] },
    background: { default: "#000", paper: tokens.panel.background },
    divider: "rgba(255, 255, 255, 0.12)",
    text: {
      primary: "rgba(255, 255, 255, 0.95)",
      secondary: "rgba(255, 255, 255, 0.72)",
    },
  },
  typography: {
    fontFamily:
      'Inter, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
  },
  components: {
    MuiButton: {
      defaultProps: { size: "small" },
      styleOverrides: {
        // Sentence case throughout; the default uppercase reads as shouting in a dense
        // control panel, and plugins were each opting out of it individually.
        root: { textTransform: "none" },
        outlined: {
          color: "rgba(255, 255, 255, 0.95)",
          borderColor: "rgba(255, 255, 255, 0.35)",
          "&:hover": {
            borderColor: "rgba(255, 255, 255, 0.65)",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          },
        },
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
    },
    MuiIconButton: {
      defaultProps: { size: "small" },
    },
    // Small keeps the controls compact without the bespoke geometry this used to set:
    // an 11x5 thumb with a 15% radius, which read as a dated rectangular handle rather
    // than a slider.
    MuiSlider: {
      defaultProps: { size: "small" },
    },
    MuiInput: {
      styleOverrides: {
        underline: {
          "&&&&:hover:before": {
            borderBottom: "1px solid #fff",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          // Matches tokens.panel.background: popovers and panels are the same surface.
          backgroundColor: tokens.panel.background,
        },
      },
    },
    MuiSvgIcon: {
      defaultProps: { fontSize: "small" },
    },
  },
});
