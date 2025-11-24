import { AccordionSummary, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import LayerVisibilityButton from "./LayerVisibilityButton";

import { useSourceData } from "../../hooks";
import LayerFitToViewportButton from "./LayerFitToViewportButton";

const DenseAccordionSummary = styled(AccordionSummary)`
  border-bottom: 1px solid rgba(150, 150, 150, .125);
  background-color: rgba(150, 150, 150, 0.25);
  display: block;
  padding: 0 3px;
  height: 27px;
  min-height: 27px;
  overflow: hidden;
  transition: none;

  &.Mui-expanded {
    min-height: 27px;
  }

  .MuiAccordionSummary-content {
    margin: 0;

    &.Mui-expanded {
      margin: 0;
    }
  }
`;

function Header({ name }: { name: string }) {
  const [sourceData] = useSourceData();
  const label = `layer-controller-${sourceData.id}`;
  return (
    <DenseAccordionSummary aria-controls={label} id={label}>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <LayerVisibilityButton />
        <LayerFitToViewportButton />
        <Typography style={{ marginTop: "4px", marginLeft: "5px" }} variant="body2">
          {name}
        </Typography>
      </div>
    </DenseAccordionSummary>
  );
}

export default Header;
