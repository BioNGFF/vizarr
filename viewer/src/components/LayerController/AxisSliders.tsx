import { Grid } from "@mui/material";
import React from "react";
import { useSourceData } from "../../hooks";
import AxisSlider from "./AxisSlider";
import { SectionHeading } from "./controls";

function AxisSliders() {
  const [sourceData] = useSourceData();
  const { axis_labels, channel_axis, loader } = sourceData;

  const sliders = axis_labels
    .slice(0, -2) // ignore last two axes, [y,x]
    .map((name, i): [string, number, number] => [name, i, loader[0].shape[i]]) // capture the name, index, and size of non-yx dims
    .filter((d) => {
      if (d[1] === channel_axis) return false; // ignore channel_axis (for OME-Zarr channel_axis === 1)
      if (d[2] > 1) return true; // keep if size > 1
      return false; // otherwise ignore as well
    })
    .map(([name, i, size]) => <AxisSlider key={name} axisIndex={i} max={size - 1} />);

  // The heading lives here rather than in Content so that it disappears along with the
  // sliders when every non-YX axis has size 1, instead of labelling nothing.
  if (sliders.length === 0) return null;
  return (
    <>
      <SectionHeading>axes</SectionHeading>
      <Grid>{sliders}</Grid>
    </>
  );
}

export default AxisSliders;
