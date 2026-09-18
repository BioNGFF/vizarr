import { AccordionSummary, Typography } from "@mui/material";
import React from "react";
import { useSourceData } from "../../hooks";
import LayerFitToViewportButton from "./LayerFitToViewportButton";
import LayerVisibilityButton from "./LayerVisibilityButton";

const ROW_HEIGHT = 28;

function Header({ name }: { name: string }) {
  const [sourceData] = useSourceData();
  const label = `layer-controller-${sourceData.id}`;
  return (
    <AccordionSummary
      aria-controls={label}
      id={label}
      sx={{
        px: 0.5,
        minHeight: ROW_HEIGHT,
        // A white-alpha tint rather than the grey wash this used before, so the header
        // belongs to the same surface family as the panel around it.
        backgroundColor: "action.hover",
        borderBottom: 1,
        borderColor: "divider",
        "&.Mui-expanded": { minHeight: ROW_HEIGHT },
        "& .MuiAccordionSummary-content": {
          m: 0,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          minWidth: 0,
          "&.Mui-expanded": { m: 0 },
        },
      }}
    >
      <LayerVisibilityButton />
      <LayerFitToViewportButton />
      <Typography variant="body2" noWrap>
        {name}
      </Typography>
    </AccordionSummary>
  );
}

export default Header;
