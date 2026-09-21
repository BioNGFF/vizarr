import { MoreHoriz, Remove } from "@mui/icons-material";
import {
  Button,
  Divider,
  IconButton,
  Input,
  NativeSelect,
  Paper,
  Popover,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import { DEFAULT_AUTO_CONTRAST_QUANTILES, maxValue, percentiles } from "../../histogram";
import { useLayerState, useSourceData } from "../../hooks";
import { useChannelHistogram } from "../../hooks/useChannelHistogram";
import { type HistogramScale, sourceWarningAtom } from "../../state";
import { arraysIdentical, getDefaultChannelLabels } from "../../utils";
import ColorPalette from "./ColorPalette";

const DenseInput = styled(Input)`
  width: 5.5em;
  font-size: 0.7em;
`;

interface Props {
  channelIndex: number;
}

function ChannelOptions({ channelIndex }: Props) {
  const [sourceData] = useSourceData();
  const [layer, setLayer] = useLayerState();
  const [anchorEl, setAnchorEl] = useState<null | Element>(null);
  // Same cache key as the sparkline, so opening the popover issues no new fetch.
  const { histogram } = useChannelHistogram(channelIndex);
  const { channel_axis, names } = sourceData;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleColorChange = (rgb: [number, number, number]) => {
    setLayer((prev) => {
      const colors = [...prev.layerProps.colors];
      colors[channelIndex] = rgb;
      return { ...prev, layerProps: { ...prev.layerProps, colors } };
    });
  };

  const handleContrastLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const targetId = event.target.id;
    let value = +event.target.value;

    // Only let positive values
    if (value < 0) value = 0;

    setLayer((prev) => {
      // Need to move sliders in if contrast limits are narrower
      const contrastLimitsRange = [...prev.layerProps.contrastLimitsRange];
      const contrastLimits = [...prev.layerProps.contrastLimits];

      const [cmin, cmax] = contrastLimitsRange[channelIndex];
      const [smin, smax] = contrastLimits[channelIndex];

      // Calculate climit update
      const [umin, umax] = targetId === "min" ? [value, cmax] : [cmin, value];

      // Update sliders if needed
      if (umin > smin) contrastLimits[channelIndex] = [umin, smax];
      if (umax < smax) contrastLimits[channelIndex] = [smin, umax];

      // Update channel constrast limits range
      contrastLimitsRange[channelIndex] = [umin, umax];

      return {
        ...prev,
        layerProps: { ...prev.layerProps, contrastLimits, contrastLimitsRange },
      };
    });
  };

  const handleAutoContrast = () => {
    if (!histogram || histogram.total === 0) return;
    const [lo, hi] = percentiles(histogram, DEFAULT_AUTO_CONTRAST_QUANTILES);

    setLayer((prev) => {
      const contrastLimits = [...prev.layerProps.contrastLimits];
      const contrastLimitsRange = [...prev.layerProps.contrastLimitsRange];
      const [rmin, rmax] = contrastLimitsRange[channelIndex];

      // Widen the slider domain to cover the data rather than clamping into it.
      // Clamping would make this a no-op whenever omero metadata declares a
      // narrow window (e.g. [0, 255]) over wider data.
      const nmin = Math.min(rmin, histogram.min);
      const nmax = Math.max(rmax, maxValue(histogram));

      // viv needs min < max; a flat plane would otherwise render black.
      let [umin, umax] = [lo, hi];
      if (!(umax > umin)) {
        umin = nmin;
        umax = Math.min(nmax, nmin + (histogram.binWidth || 1));
        if (!(umax > umin)) umax = umin + 1;
      }

      contrastLimitsRange[channelIndex] = [nmin, nmax];
      contrastLimits[channelIndex] = [umin, umax];
      return { ...prev, layerProps: { ...prev.layerProps, contrastLimits, contrastLimitsRange } };
    });
  };

  const handleHistogramScaleChange = (_: MouseEvent<HTMLElement>, value: HistogramScale | null) => {
    // An exclusive ToggleButtonGroup reports null when the active button is re-clicked.
    if (!value) return;
    setLayer((prev) => ({ ...prev, histogramScale: value }));
  };

  const handleRemove = () => {
    setLayer((prev) => {
      const { layerProps } = prev;
      const colors = [...layerProps.colors];
      const contrastLimits = [...layerProps.contrastLimits];
      const contrastLimitsRange = [...layerProps.contrastLimitsRange];
      const selections = [...layerProps.selections];
      const channelsVisible = [...layerProps.channelsVisible];
      colors.splice(channelIndex, 1);
      contrastLimits.splice(channelIndex, 1);
      contrastLimitsRange.splice(channelIndex, 1);
      selections.splice(channelIndex, 1);
      channelsVisible.splice(channelIndex, 1);
      return {
        ...prev,
        layerProps: {
          ...layerProps,
          colors,
          selections,
          channelsVisible,
          contrastLimits,
          contrastLimitsRange,
        },
      };
    });
  };

  const handleSelectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLayer((prev) => {
      const selections = [...prev.layerProps.selections];
      const channelSelection = [...selections[channelIndex]];
      if (Number.isInteger(channel_axis)) {
        channelSelection[channel_axis as number] = +event.target.value;
        selections[channelIndex] = channelSelection;
      }
      return { ...prev, layerProps: { ...prev.layerProps, selections } };
    });
  };

  const open = Boolean(anchorEl);
  const id = open ? `channel-${channelIndex}-${sourceData.name}-options` : undefined;
  const [min, max] = layer.layerProps.contrastLimitsRange[channelIndex];

  return (
    <>
      <IconButton
        onClick={handleClick}
        aria-describedby={id}
        style={{
          backgroundColor: "transparent",
          padding: 0,
          zIndex: 2,
          cursor: "pointer",
        }}
      >
        <MoreHoriz />
      </IconButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <Paper style={{ padding: "0px 4px", marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption">remove:</Typography>
            <IconButton onClick={handleRemove}>
              <Remove />
            </IconButton>
          </div>
          <Divider />
          <Typography variant="caption">selection:</Typography>
          <Divider />
          <NativeSelect
            fullWidth
            style={{ fontSize: "0.7em" }}
            id={`layer-${sourceData.name}-channel-select`}
            onChange={handleSelectionChange}
            value={layer.layerProps.selections[channelIndex][channel_axis as number]}
          >
            {names.map((name, i) => (
              <option value={i} key={name}>
                ({i}) {name}
              </option>
            ))}
          </NativeSelect>
          <Divider />
          <Typography variant="caption">contrast limits:</Typography>
          <Divider />
          <DenseInput value={min} onChange={handleContrastLimitChange} type="number" id="min" fullWidth={false} />
          <DenseInput value={max} onChange={handleContrastLimitChange} type="number" id="max" fullWidth={false} />
          <Button
            fullWidth
            onClick={handleAutoContrast}
            disabled={!histogram || histogram.total === 0}
            style={{ fontSize: "0.6em", minWidth: 0 }}
          >
            auto 1–99%
          </Button>
          <Divider />
          <Typography variant="caption">histogram scale:</Typography>
          <Divider />
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={layer.histogramScale}
            onChange={handleHistogramScaleChange}
          >
            <ToggleButton value="log" style={{ fontSize: "0.6em", padding: "1px 8px" }}>
              log
            </ToggleButton>
            <ToggleButton value="linear" style={{ fontSize: "0.6em", padding: "1px 8px" }}>
              linear
            </ToggleButton>
          </ToggleButtonGroup>
          <Divider />
          <Typography variant="caption">color:</Typography>
          <Divider />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ColorPalette handleChange={handleColorChange} />
          </div>
        </Paper>
      </Popover>
    </>
  );
}

export default ChannelOptions;
