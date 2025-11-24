import { Slider } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import type { ChangeEvent } from "react";
import { useLayerState } from "../../hooks";

const DenseSlider = styled(Slider)`
  color: white;
  padding: 10px 0px 5px 0px;
  margin-right: 5px;
  :active {
    box-shadow: 0px 0px 0px 8px rgba(158, 158, 158, 0.16);
  }
`;

function OpacitySlider() {
  const [layer, setLayer] = useLayerState();
  const handleChange = (_: Event, value: number | number[]) => {
    const opacity = value as number;
    setLayer((prev) => ({ ...prev, layerProps: { ...prev.layerProps, opacity } }));
  };
  return <DenseSlider value={layer.layerProps.opacity} onChange={handleChange} min={0} max={1} step={0.01} />;
}

export default OpacitySlider;
