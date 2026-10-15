import { Visibility, VisibilityOff } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/material";
import React from "react";
import type { MouseEvent } from "react";
import { useLayerState, useSourceData } from "../../hooks";

function LayerVisibilityButton() {
  const [sourceData] = useSourceData();
  const [layer, setLayer] = useLayerState();
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setLayer((prev) => {
      const on = !prev.on;
      return { ...prev, on };
    });
  };
  return (
    <Tooltip title={layer.on ? "Hide image" : "Show image"}>
      <IconButton
        component="span"
        aria-label={`toggle-layer-visibility-${sourceData.id}`}
        onClick={toggle}
        sx={{
          backgroundColor: "transparent",
          color: `rgb(255, 255, 255, ${layer.on ? 1 : 0.5})`,
        }}
      >
        {layer.on ? <Visibility /> : <VisibilityOff />}
      </IconButton>
    </Tooltip>
  );
}

export default LayerVisibilityButton;
