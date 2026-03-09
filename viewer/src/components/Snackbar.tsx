import { type SnackbarKey, SnackbarProvider, closeSnackbar, enqueueSnackbar } from "notistack";
import React from "react";

export function InfoSnackbar(props: { message: string }) {
  const hideSnackbar = (snackbarId: SnackbarKey) => (
    <>
      <button
        onClick={() => {
          closeSnackbar(snackbarId);
        }}
      >
        Dismiss
      </button>
    </>
  );

  React.useEffect(() => {
    enqueueSnackbar(props.message, { action: hideSnackbar });
  });

  return (
    <div>
      <SnackbarProvider
        anchorOrigin={{ horizontal: "right", vertical: "top" }}
        autoHideDuration={null}
        variant={"warning"}
        preventDuplicate={true}
      ></SnackbarProvider>
    </div>
  );
}
