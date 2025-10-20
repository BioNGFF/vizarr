import { IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
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
    <IconButton
      component="span"
      aria-label={`toggle-layer-visibility-${sourceData.id}`}
      onClick={toggle}
      sx={{
        backgroundColor: "transparent",
        marginTop: "2px",
        color: `rgb(255, 255, 255, ${layer.on ? 1 : 0.5})`,
      }}
    >
      {layer.on ? <Visibility /> : <VisibilityOff />}
    </IconButton>
  );
}

export default LayerVisibilityButton;
