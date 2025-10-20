import { Grid, IconButton, Slider, Typography } from "@mui/material";
import { RadioButtonChecked, RadioButtonUnchecked } from "@mui/icons-material";
import React from "react";
import { useLayerState, useSourceData } from "../../hooks";
import ChannelOptions from "./ChannelOptions";

function ChannelController({ channelIndex }: { channelIndex: number }) {
  const [sourceData] = useSourceData();
  const [layer, setLayer] = useLayerState();

  const handleContrastChange = (_: Event, v: number | number[]) => {
    setLayer((prev) => {
      const contrastLimits = [...prev.layerProps.contrastLimits];
      contrastLimits[channelIndex] = v as [number, number];
      return { ...prev, layerProps: { ...prev.layerProps, contrastLimits } };
    });
  };
  const handleVisibilityChange = () => {
    setLayer((prev) => {
      const channelsVisible = [...prev.layerProps.channelsVisible];
      channelsVisible[channelIndex] = !channelsVisible[channelIndex];
      return { ...prev, layerProps: { ...prev.layerProps, channelsVisible } };
    });
  };

  const lp = layer.layerProps;

  // Material slider tries to sort in place. Need to copy.
  const value = [...lp.contrastLimits[channelIndex]];
  const color = `rgb(${lp.colormap ? [255, 255, 255] : lp.colors[channelIndex]})`;
  const on = lp.channelsVisible[channelIndex];
  const [min, max] = lp.contrastLimitsRange[channelIndex];

  const { channel_axis, names } = sourceData;
  const selection = lp.selections[channelIndex];
  const nameIndex = Number.isInteger(channel_axis) ? selection[channel_axis as number] : 0;
  const label = names[nameIndex];
  return (
    <>
      <Grid container justifyContent="space-between" wrap="nowrap">
        <Grid size={{ xs: 10 }}>
          <div style={{ width: 165, overflow: "hidden", textOverflow: "ellipsis" }}>
            <Typography variant="caption" noWrap>
              {label}
            </Typography>
          </div>
        </Grid>
        <Grid size={{ xs: 1 }}>
          <ChannelOptions channelIndex={channelIndex} />
        </Grid>
      </Grid>
      <Grid container justifyContent="space-between">
        <Grid size={{ xs: 2 }}>
          <IconButton
            style={{
              color,
              backgroundColor: "transparent",
              padding: 0,
              zIndex: 2,
            }}
            onClick={handleVisibilityChange}
          >
            {on ? <RadioButtonChecked /> : <RadioButtonUnchecked />}
          </IconButton>
        </Grid>
        <Grid size={{ xs: 10 }}>
          <Slider
            value={value}
            onChange={handleContrastChange}
            min={min}
            max={max}
            step={0.01}
            style={{
              padding: "10px 0px 5px 0px",
              color,
            }}
          />
        </Grid>
      </Grid>
    </>
  );
}

export default ChannelController;
