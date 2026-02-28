import { ErrorSeverity, type ErrorDetails } from "../types";
import { SnackbarProvider, closeSnackbar, enqueueSnackbar, type SnackbarKey } from "notistack";
import React from "react";

function mapSeverity(severity: ErrorSeverity) {
  switch (severity) {
    case ErrorSeverity.WARNING:
      return 'warning'
    case ErrorSeverity.ERROR:
      return 'error'
  }
}

export function InfoSnackbar(props: { errorDetails: ErrorDetails }) {

  const hideSnackbar = snackbarId => (
    <>
      <button onClick={() => { closeSnackbar(snackbarId) }}>
        Dismiss
      </button>
    </>
  );


  React.useEffect(() => {
    enqueueSnackbar(props.errorDetails.message, { action: hideSnackbar })
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


