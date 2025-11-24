import { grey } from "@mui/material/colors";
import { createTheme } from "@mui/material/styles";

export default createTheme({
  palette: {
    mode: "dark",
    primary: { main: grey[500] },
    secondary: { main: grey[500] },
  },
  components: {
    MuiButton: {
      defaultProps: { size: "small" },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
    },
    MuiFilledInput: {
      defaultProps: { margin: "dense" },
    },
    MuiFormControl: {
      defaultProps: { margin: "dense" },
    },
    MuiFormHelperText: {
      defaultProps: { margin: "dense" },
    },
    MuiIconButton: {
      defaultProps: { size: "small" },
    },
    MuiInputBase: {
      defaultProps: { margin: "dense" },
    },
    MuiInputLabel: {
      defaultProps: { margin: "dense" },
    },
    MuiOutlinedInput: {
      defaultProps: { margin: "dense" },
    },

    MuiSlider: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        thumb: {
          "&:focus, &:hover": {
            boxShadow: "none",
          },
          height: 11,
          width: 5,
          borderRadius: "15%",
          marginLeft: -1,
        },
      },
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
          backgroundColor: "rgba(0, 0, 0, 0.8)",
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          width: "0.7em",
          height: "0.7em",
        },
      },
    },
  },
});
