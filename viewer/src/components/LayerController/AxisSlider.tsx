import { Divider, Grid } from "@mui/material";
import * as React from "react";
import { useLayerState, useSourceData } from "../../hooks";
import DimensionOptions from "./AxisOptions";
import { ControlLabel, DenseSlider } from "./controls";

interface Props {
  axisIndex: number;
  max: number;
}

function AxisSlider({ axisIndex, max }: Props) {
  const [layer, setLayer] = useLayerState();
  const [sourceData] = useSourceData();
  const { axis_labels } = sourceData;
  let axisLabel = axis_labels[axisIndex];
  if (axisLabel === "t" || axisLabel === "z") {
    axisLabel = axisLabel.toUpperCase();
  }
  // state of the slider to update UI while dragging
  const [value, setValue] = React.useState(0);

  // If axis index change externally, need to update state
  React.useEffect(() => {
    // Use first channel to get initial value of slider - can be undefined on first render
    setValue(layer.layerProps.selections[0] ? layer.layerProps.selections[0][axisIndex] : 1);
  }, [layer.layerProps.selections, axisIndex]);

  const handleRelease = () => {
    setLayer((prev) => {
      let layerProps = { ...prev.layerProps };
      // for each channel, update index of this axis
      layerProps.selections = layerProps.selections.map((ch) => {
        let new_ch = [...ch];
        new_ch[axisIndex] = value;
        return new_ch;
      });
      return { ...prev, layerProps };
    });
  };

  const handleDrag = (_: Event, value: number | number[]) => {
    setValue(value as number);
  };

  return (
    <>
      <Grid>
        <Grid container justifyContent="space-between">
          <Grid size={{ xs: 10 }}>
            <ControlLabel>
              {axisLabel}: {value}/{max}
            </ControlLabel>
          </Grid>
          <Grid size={{ xs: 1 }}>
            <DimensionOptions axisIndex={axisIndex} max={max} />
          </Grid>
        </Grid>
        <Grid container justifyContent="space-between">
          <Grid size={{ xs: 12 }}>
            <DenseSlider
              value={value}
              onChange={handleDrag}
              onChangeCommitted={handleRelease}
              min={0}
              max={max}
              step={1}
            />
          </Grid>
        </Grid>
      </Grid>
      <Divider />
    </>
  );
}

export default AxisSlider;
