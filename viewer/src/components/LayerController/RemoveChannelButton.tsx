import { Delete } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/material";
import { useLayerState } from "../../hooks";

function RemoveChannelButton({ channelIndex, name }: { channelIndex: number; name: string }) {
  const [, setLayer] = useLayerState();

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

  return (
    <Tooltip title="Remove channel">
      <IconButton onClick={handleRemove} aria-label={`Remove channel ${name}`}>
        <Delete />
      </IconButton>
    </Tooltip>
  );
}

export default RemoveChannelButton;
