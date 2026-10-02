import { Add } from "@mui/icons-material";
import { Button, Menu, MenuItem } from "@mui/material";
import type { MouseEvent } from "react";
import { useState } from "react";

import { useLayerState, useSourceData } from "../../hooks";
import { MAX_CHANNELS, calcDataRange, hexToRGB, resolveLoaderFromLayerProps } from "../../utils";
import { menuPaperSx } from "./controls";

function AddChannelButton() {
  const [source, setSource] = useSourceData();
  const [layer, setLayer] = useLayerState();
  const [anchorEl, setAnchorEl] = useState<null | Element>(null);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = async (channelIndex: number) => {
    handleClose();
    const channelSelection = [...source.defaults.selection];
    if (source.channel_axis != null) {
      channelSelection[source.channel_axis] = channelIndex;
    }

    // cacluate contrast limits if missing from source;
    let lim: [min: number, max: number];
    if (source.contrast_limits[channelIndex]) {
      lim = source.contrast_limits[channelIndex] as [number, number];
    } else {
      const loader = resolveLoaderFromLayerProps(layer.layerProps);
      const lowres = Array.isArray(loader) ? loader[loader.length - 1] : loader;
      lim = await calcDataRange(lowres, channelSelection);
      // Update source data with newly calculated limit
      setSource((prev) => {
        const clims = [...prev.contrast_limits];
        clims[channelIndex] = lim;
        return { ...prev, contrast_limits: clims };
      });
    }
    setLayer((prev) => {
      const { layerProps } = prev;
      const selections = [...layerProps.selections, channelSelection];
      const colors = [...layerProps.colors, hexToRGB(source.colors[channelIndex])];
      const contrastLimits = [...layerProps.contrastLimitsRange, lim];
      const channelsVisible = [...layerProps.channelsVisible, true];
      return {
        ...prev,
        layerProps: {
          ...layerProps,
          selections,
          colors,
          contrastLimits,
          contrastLimitsRange: [...contrastLimits],
          channelsVisible,
        },
      };
    });
  };

  const { names } = source;
  const open = Boolean(anchorEl);
  const id = open ? `layer-${source.id}-add-channel` : undefined;
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<Add />}
        onClick={handleClick}
        aria-describedby={id}
        sx={{ fontSize: "0.7rem", py: 0, px: 1, "& .MuiButton-startIcon": { mr: 0.5 } }}
        disabled={layer.layerProps.selections.length === MAX_CHANNELS}
      >
        ADD
      </Button>
      <Menu
        id={id}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        {names.map((name, i) => (
          <MenuItem key={name} dense onClick={() => handleSelect(i)}>
            {name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export default AddChannelButton;
