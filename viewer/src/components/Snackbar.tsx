import { type SnackbarKey, SnackbarProvider, closeSnackbar, enqueueSnackbar } from "notistack";
import React from "react";

const dismissAction = (snackbarId: SnackbarKey) => (
  <button
    type="button"
    onClick={() => {
      closeSnackbar(snackbarId);
    }}
  >
    Dismiss
  </button>
);

/**
 * Hosts the notistack container. Render exactly once, before any <InfoSnackbar/>:
 * `enqueueSnackbar` is a global imperative API, so several containers would compete
 * for the same queue.
 */
export function SnackbarHost() {
  return (
    <SnackbarProvider
      anchorOrigin={{ horizontal: "right", vertical: "top" }}
      autoHideDuration={null}
      variant={"warning"}
      preventDuplicate={true}
    />
  );
}

/**
 * Enqueues a single message. Keyed on the message so it is enqueued once rather than
 * on every render, which would restart the toast's animation indefinitely.
 */
export function InfoSnackbar({ message }: { message: string }) {
  React.useEffect(() => {
    enqueueSnackbar(message, { action: dismissAction });
  }, [message]);

  return null;
}
