import { AccordionSummary, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import LayerVisibilityButton from "./LayerVisibilityButton";

import { useLayerState, useSourceData } from "../../hooks";
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
  const [layer] = useLayerState();
  const label = `layer-controller-${sourceData.id}`;
  const nChannels = layer.layerProps.selections.length;
  return (
    <DenseAccordionSummary aria-controls={label} id={label}>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <LayerVisibilityButton />
        <LayerFitToViewportButton />
        {/* minWidth: 0 lets a long name actually ellipsize inside the flex row
            instead of pushing the channel count out of the 200px panel. */}
        <Typography style={{ marginLeft: "5px", minWidth: 0 }} variant="body2" noWrap>
          {name}
        </Typography>
        {/* Says how many channels exist before you scroll, so a list running
            past the fold doesn't read as channels having failed to load. */}
        <Typography
          variant="caption"
          title={`${nChannels} channel${nChannels === 1 ? "" : "s"}`}
          style={{ flexShrink: 0, marginLeft: "auto", paddingLeft: 4, opacity: 0.65 }}
        >
          {nChannels} ch
        </Typography>
      </div>
    </DenseAccordionSummary>
  );
}

export default Header;
