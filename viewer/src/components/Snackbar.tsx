import { Close, WarningAmberRounded } from "@mui/icons-material";
import { Box, IconButton, Typography } from "@mui/material";
import { type CustomContentProps, SnackbarContent, SnackbarProvider, closeSnackbar, enqueueSnackbar } from "notistack";
import React from "react";
import { tokens } from "../theme";

/**
 * Toast body, styled from the shared tokens rather than notistack's built-in variant.
 * The default `warning` variant paints a bright amber slab that ignores the theme and
 * reads as an error next to the viewer's dark chrome.
 */
const WarningSnackbar = React.forwardRef<HTMLDivElement, CustomContentProps>(({ id, message }, ref) => (
  <SnackbarContent ref={ref}>
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        // Long messages wrap rather than stretching the toast across the viewport.
        maxWidth: 420,
        px: 1.5,
        py: 1,
        backgroundColor: tokens.panel.background,
        border: `1px solid ${tokens.panel.border}`,
        borderRadius: `${tokens.panel.radius}px`,
        backdropFilter: "blur(2px)",
      }}
    >
      <WarningAmberRounded sx={{ color: "warning.main", mt: "2px", flexShrink: 0 }} />
      <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
        {message}
      </Typography>
      <IconButton
        onClick={() => closeSnackbar(id)}
        aria-label="Dismiss notification"
        sx={{ color: "text.secondary", flexShrink: 0, "&:hover": { color: "text.primary" } }}
      >
        <Close />
      </IconButton>
    </Box>
  </SnackbarContent>
));
WarningSnackbar.displayName = "WarningSnackbar";

/**
 * Hosts the notistack container. Render exactly once, before any <InfoSnackbar/>:
 * `enqueueSnackbar` is a global imperative API, so several containers would compete
 * for the same queue.
 *
 * Anchored bottom-centre to stay clear of the controls panel on the left and the host's
 * plugin panels on the right, and to match the ROI plugin's own snackbar.
 */
export function SnackbarHost() {
  return (
    <SnackbarProvider
      anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
      autoHideDuration={null}
      variant={"warning"}
      preventDuplicate={true}
      Components={{ warning: WarningSnackbar }}
    />
  );
}

/**
 * Enqueues a single message. Keyed on the message so it is enqueued once rather than
 * on every render, which would restart the toast's animation indefinitely.
 */
export function InfoSnackbar({ message }: { message: string }) {
  React.useEffect(() => {
    enqueueSnackbar(message, { variant: "warning" });
  }, [message]);

  return null;
}
