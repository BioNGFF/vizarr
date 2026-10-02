import React from "react";
import { useLayerState } from "../../hooks";
import { DenseSlider } from "./controls";

function OpacitySlider() {
  const [layer, setLayer] = useLayerState();
  const handleChange = (_: Event, value: number | number[]) => {
    const opacity = value as number;
    setLayer((prev) => ({ ...prev, layerProps: { ...prev.layerProps, opacity } }));
  };
  return <DenseSlider value={layer.layerProps.opacity} onChange={handleChange} min={0} max={1} step={0.01} />;
}

export default OpacitySlider;
