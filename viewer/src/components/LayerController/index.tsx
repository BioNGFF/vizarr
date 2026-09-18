import { Accordion } from "@mui/material";
import React from "react";

import { LayerStateContext, useSourceData } from "../../hooks";
import { layerFamilyAtom } from "../../state";
import Content from "./Content";
import Header from "./Header";

function LayerController() {
  const [sourceInfo] = useSourceData();
  const layerAtom = layerFamilyAtom(sourceInfo);
  return (
    <LayerStateContext.Provider value={layerAtom}>
      <Accordion
        defaultExpanded
        disableGutters
        square
        elevation={0}
        sx={{
          // The surrounding panel already provides the surface. Accordion is a Paper, so
          // without this the theme's MuiPaper background is painted a second time on top
          // of the panel's and the section reads as a darker box inside it.
          backgroundColor: "transparent",
          backgroundImage: "none",
          "&:before": { display: "none" },
          // Separates stacked images without boxing each one in on all four sides.
          "&:not(:last-of-type)": { borderBottom: 1, borderColor: "divider" },
        }}
      >
        <Header name={sourceInfo.name ?? ""} />
        <Content />
      </Accordion>
    </LayerStateContext.Provider>
  );
}

export default LayerController;
