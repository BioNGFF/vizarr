import { MoreVert } from "@mui/icons-material";
import { Box, IconButton, NativeSelect, Paper, Popover, Stack, Typography } from "@mui/material";
import React, { useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import { useLayerState, useSourceData } from "../../hooks";
import ColorPalette from "./ColorPalette";
import { DenseInput, SectionHeading, denseSelectSx, popoverPaperSx } from "./controls";

interface Props {
  channelIndex: number;
}

function ChannelOptions({ channelIndex }: Props) {
  const [sourceData] = useSourceData();
  const [layer, setLayer] = useLayerState();
  const [anchorEl, setAnchorEl] = useState<null | Element>(null);
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
        <MoreVert />
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
        <Paper sx={{ ...popoverPaperSx, width: 240 }}>
          <Stack spacing={1.5}>
            <Box>
              <SectionHeading>selection</SectionHeading>
              <NativeSelect
                fullWidth
                sx={denseSelectSx}
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
            </Box>

            <Box>
              <SectionHeading>contrast limits</SectionHeading>
              {/* Labelled: two bare number fields side by side gave no clue which was
                  which. */}
              <Box sx={{ display: "flex", gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    min
                  </Typography>
                  <DenseInput
                    value={min}
                    onChange={handleContrastLimitChange}
                    type="number"
                    id="min"
                    sx={{ width: "100%" }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    max
                  </Typography>
                  <DenseInput
                    value={max}
                    onChange={handleContrastLimitChange}
                    type="number"
                    id="max"
                    sx={{ width: "100%" }}
                  />
                </Box>
              </Box>
            </Box>

            <Box>
              <SectionHeading>colour</SectionHeading>
              <ColorPalette handleChange={handleColorChange} />
            </Box>
          </Stack>
        </Paper>
      </Popover>
    </>
  );
}

export default ChannelOptions;
