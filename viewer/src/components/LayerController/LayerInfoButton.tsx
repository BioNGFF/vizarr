import { InfoOutlined } from "@mui/icons-material";
import { Dialog, DialogContent, DialogTitle, IconButton, Tooltip, Typography } from "@mui/material";
import React, { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useSourceData } from "../../hooks";

/**
 * Per-image details, opened from that image's header.
 *
 * This previously lived in the panel's title bar, where it looked like information
 * about the application but in fact always described the first source, whatever else
 * was loaded.
 */
function LayerInfoButton() {
  const [sourceData] = useSourceData();
  const [open, setOpen] = useState(false);

  const description = useMemo(() => {
    const channels = sourceData.names.length;
    const shape = sourceData.loader[0]?.shape?.join(" x ") ?? "unknown shape";
    return `${channels} channel${channels === 1 ? "" : "s"} available. Base array shape: ${shape}.`;
  }, [sourceData]);

  // The header is the accordion's toggle, so a click here must not also collapse it.
  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <Tooltip title="Image information">
        <IconButton
          component="span"
          onClick={handleOpen}
          aria-label={`Information about ${sourceData.name ?? "this image"}`}
          sx={{ backgroundColor: "transparent" }}
        >
          <InfoOutlined />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{sourceData.name ?? "Image"}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">{description}</Typography>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default LayerInfoButton;
