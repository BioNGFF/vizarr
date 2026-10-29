import { grey } from "@mui/material/colors";
import { createTheme } from "@mui/material/styles";

/**
 * Surface values that MUI's palette has no slot for, so that overlay panels and the
 * toolbar rail are defined once rather than repeated as literals at each use site.
 * Plugins should style their own panels from these so they match the viewer's chrome.
 */
/** The opaque dark shared by the toolbar rail and by anything laid over the image. */
const SOLID_DARK = "#151515";

export const tokens = {
  /** Width of the collapsible controls panel. */
  layout: {
    panelWidth: { xs: 280, sm: 340 },
  },
  /** Floating panel laid over the image. */
  panel: {
    background: "rgba(0, 0, 0, 0.72)",
    border: "rgba(255, 255, 255, 0.38)",
    inset: "rgba(255, 255, 255, 0.18)",
    radius: 8,
  },
  /**
   * Menus, popovers and dialogs. Opaque, unlike the panel: the panel is deliberately
   * translucent so the image reads through it, but content has to be legible against
   * whatever it happens to cover.
   */
  overlay: {
    background: SOLID_DARK,
  },
  /** Toolbar rail buttons, which sit directly on the image and need more contrast. */
  rail: {
    background: SOLID_DARK,
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
          // Paper is only used here for overlays — menus, popovers, dialogs and the
          // error card. The controls panel is a Box and sets its own translucent
          // background, so this does not need to match it.
          backgroundColor: tokens.overlay.background,
        },
      },
    },
    MuiSvgIcon: {
      defaultProps: { fontSize: "small" },
    },
  },
});
