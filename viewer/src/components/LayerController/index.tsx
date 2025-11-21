import { Accordion as MuiAccordion } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

import { LayerStateContext, useSourceData } from "../../hooks";
import { layerFamilyAtom } from "../../state";
import Content from "./Content";
import Header from "./Header";

const Accordion = styled(MuiAccordion)`
  border-bottom: 1px solid rgba(150, 150, 150, .2);
  width: 200;
  box-shadow: none;
  "&:not(:last-child)": {
    border-bottom: 0,
  }
  "&:before": {
    display: none,
  }
  "&$expanded": {
    margin: 0,
    padding: 0,
  }
  &.Mui-expanded : {
    padding: 1,
  }
`;

function LayerController() {
  const [sourceInfo] = useSourceData();
  const layerAtom = layerFamilyAtom(sourceInfo);
  return (
    <LayerStateContext.Provider value={layerAtom}>
      <Accordion defaultExpanded>
        <Header name={sourceInfo.name ?? ""} />
        <Content />
      </Accordion>
    </LayerStateContext.Provider>
  );
}

export default LayerController;
