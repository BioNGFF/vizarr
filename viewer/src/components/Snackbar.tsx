import { ErrorSeverity, type ErrorDetails } from "../types";
import { SnackbarProvider, closeSnackbar, enqueueSnackbar, type SnackbarKey } from "notistack";
import React from "react";

export function InfoSnackbar(props: { message: string }) {

  const hideSnackbar = snackbarId => (
    <>
      <button onClick={() => { closeSnackbar(snackbarId) }}>
        Dismiss
      </button>
    </>
  );


  React.useEffect(() => {
    enqueueSnackbar(props.message, { action: hideSnackbar })
  })

  return (
    <div>
      <SnackbarProvider
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        autoHideDuration={null}
        variant={'warning'}
        preventDuplicate={true}
      ></SnackbarProvider>
    </div >
  )
}


