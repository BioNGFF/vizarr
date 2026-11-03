import { Box, Grid, Typography } from "@mui/material";
import * as React from "react";
import { useLayerState, useSourceData } from "../../hooks";
import { resolveScreenOrientation } from "../../orientation";
import DimensionOptions from "./AxisOptions";
import { ControlLabel, DenseSlider } from "./controls";

interface Props {
  axisIndex: number;
  max: number;
}

function AxisSlider({ axisIndex, max }: Props) {
  const [layer, setLayer] = useLayerState();
  const [sourceData] = useSourceData();
  const { axis_labels, axes, model_matrix } = sourceData;
  const name = axis_labels[axisIndex];
  let axisLabel = name;
  if (axisLabel === "t" || axisLabel === "z") {
    axisLabel = axisLabel.toUpperCase();
  }

  // RFC-4 orientation for an axis that points out of the view, which is the only place
  // it can be shown: the edge labels can only speak for the two axes on screen. The
  // ends are ordered the way the slider travels, so the arrow reads with the handle
  // rather than against it.
  const direction = React.useMemo(
    () => resolveScreenOrientation(axes, model_matrix).throughPlane[name],
    [axes, model_matrix, name],
  );
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
              {axisLabel} ({value}/{max})
              {direction && (
                <Typography component="span" variant="caption" sx={{ opacity: 0.6, ml: 0.75 }}>
                  {direction.from} &rarr; {direction.to}
                </Typography>
              )}
            </ControlLabel>
          </Grid>
          <Grid size={{ xs: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <DimensionOptions axisIndex={axisIndex} max={max} />
            </Box>
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
    </>
  );
}

export default AxisSlider;
