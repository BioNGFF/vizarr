import { Accordion } from "@mui/material";
import React from "react";

import { LayerStateContext, useSourceData } from "../../hooks";
import { layerFamilyAtom } from "../../state";
import { tokens } from "../../theme";
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
          // Each image reads as a card in the same family as the toolbar buttons:
          // lifted slightly off the panel, outlined, and with the same corner radius.
          // backgroundImage is cleared because Paper paints an overlay gradient over it.
          backgroundColor: tokens.rail.background,
          backgroundImage: "none",
          border: `1px solid ${tokens.rail.border}`,
          borderRadius: `${tokens.rail.radius}px`,
          overflow: "hidden",
          "&:before": { display: "none" },
          "&:not(:first-of-type)": { mt: 1 },
        }}
      >
        <Header name={sourceInfo.name ?? ""} />
        <Content />
      </Accordion>
    </LayerStateContext.Provider>
  );
}

export default LayerController;
