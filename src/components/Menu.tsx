import { Box, Grid, IconButton } from "@mui/material";
import { Add, Remove } from "@mui/icons-material";
import { useAtomValue } from "jotai";
import React, { useReducer } from "react";

import { SourceDataContext } from "../hooks";
import { sourceInfoAtomAtoms } from "../state";
import LayerController from "./LayerController";

function Menu(props: { open?: boolean }) {
  const sourceAtoms = useAtomValue(sourceInfoAtomAtoms);
  const [hidden, toggle] = useReducer((v) => !v, !(props.open ?? true));
  return (
    <Box
      sx={{
        zIndex: 1,
        position: "absolute",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderRadius: "5px",
        left: "5px",
        top: "5px",
      }}
      style={{ padding: `0px 5px ${hidden ? 0 : 5}px 5px` }}
    >
      <Grid container direction="column" alignItems="flex-start">
        <IconButton style={{ backgroundColor: "transparent", padding: 0 }} onClick={toggle}>
          {hidden ? <Add /> : <Remove />}
        </IconButton>
        <Box
          sx={{
            maxHeight: 500,
            overflowX: "hidden",
            overflowY: "scroll",
            "&::-webkit-scrollbar": {
              display: "none",
              background: "transparent",
            },
            scrollbarWidth: "none",
            flexDirection: "column",
          }}
          style={{ display: hidden ? "none" : "flex" }}
        >
          {sourceAtoms.map((sourceAtom) => (
            <SourceDataContext.Provider key={`${sourceAtom}`} value={sourceAtom}>
              <LayerController />
            </SourceDataContext.Provider>
          ))}
        </Box>
      </Grid>
    </Box>
  );
}

export default Menu;
