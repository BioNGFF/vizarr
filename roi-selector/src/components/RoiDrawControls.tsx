import { HighlightAlt } from "@mui/icons-material";
import { Button, Grid } from "@mui/material";
import React from "react";

import type { PendingRoi, RoiDrawState } from "../state";

interface RoiDrawControlsProps {
  editingRoiId: string | null;
  pendingRoi: PendingRoi | null;
  isDrawing: boolean;
  roiDrawState: RoiDrawState;
  onToggleDraw: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onUpdate: () => void;
  onCancelEdit: () => void;
}

const btnSx = { textTransform: "none" as const, fontSize: 11 };

export default function RoiDrawControls({
  editingRoiId,
  pendingRoi,
  isDrawing,
  roiDrawState,
  onToggleDraw,
  onSave,
  onDiscard,
  onUpdate,
  onCancelEdit,
}: RoiDrawControlsProps) {
  if (editingRoiId) {
    return (
      <Grid container spacing={1} sx={{ mt: 0.5, mb: 0.5 }}>
        <Grid size={{ xs: 6 }}>
          <Button
            variant="contained"
            size="small"
            fullWidth
            onClick={onUpdate}
            color="success"
            sx={btnSx}
          >
            Update ROI
          </Button>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={onCancelEdit}
            color="error"
            sx={btnSx}
          >
            Cancel
          </Button>
        </Grid>
      </Grid>
    );
  }

  if (pendingRoi) {
    return (
      <Grid container spacing={1} sx={{ mt: 0.5, mb: 0.5 }}>
        <Grid size={{ xs: 6 }}>
          <Button
            variant="contained"
            size="small"
            fullWidth
            onClick={onSave}
            color="success"
            sx={btnSx}
          >
            Save ROI
          </Button>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={onDiscard}
            color="error"
            sx={btnSx}
          >
            Discard
          </Button>
        </Grid>
      </Grid>
    );
  }

  return (
    <Button
      variant={isDrawing ? "contained" : "outlined"}
      size="small"
      fullWidth
      onClick={onToggleDraw}
      startIcon={<HighlightAlt fontSize="small" />}
      color={isDrawing ? "warning" : "primary"}
      sx={{ ...btnSx, mt: 0.5, mb: 0.5 }}
    >
      {isDrawing
        ? roiDrawState === "waiting-first"
          ? "Click corner 1…"
          : "Click corner 2…"
        : "Draw on image"}
    </Button>
  );
}
