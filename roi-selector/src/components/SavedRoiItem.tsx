import { ContentCopy, Delete, Edit, MyLocation, VisibilityOff } from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useState } from "react";

import { type SavedRoi, normalizeRoiBounds } from "../state";

/** Format a physical coordinate for compact display (up to 2 dp). */
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

interface SavedRoiItemProps {
  roi: SavedRoi;
  hasZAxis: boolean;
  hasTAxis: boolean;
  isEditing: boolean;
  onToggleVisibility: () => void;
  onGoTo: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SavedRoiItem({
  roi,
  hasZAxis,
  hasTAxis,
  isEditing,
  onToggleVisibility,
  onGoTo,
  onCopy,
  onEdit,
  onDelete,
}: SavedRoiItemProps) {
  const bounds = normalizeRoiBounds(roi);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete ROI</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete "{roi.name}"?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              setConfirmOpen(false);
              onDelete();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          py: 0.25,
          px: 0.5,
          borderRadius: 0.5,
          "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" },
        }}
      >
        {/* Color dot — click to toggle visibility */}
        <Tooltip title={roi.visible ? "Hide overlay" : "Show overlay"}>
          <IconButton
            size="small"
            onClick={onToggleVisibility}
            sx={{ p: 0, mr: 0.5, flexShrink: 0, width: 16, height: 16, minWidth: 0 }}
          >
            {roi.visible ? (
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: `rgb(${roi.color.join(",")})`,
                }}
              />
            ) : (
              <VisibilityOff sx={{ fontSize: 12, color: "grey.600" }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Name + Coordinates + Z info */}
        <Box sx={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: "#fff",
              fontWeight: 600,
              fontSize: 10,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {roi.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "grey.400",
              fontFamily: "monospace",
              fontSize: 10,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            ({fmt(bounds.min.x)}, {fmt(bounds.min.y)}) → ({fmt(bounds.max.x)}, {fmt(bounds.max.y)})
          </Typography>
          {hasZAxis && bounds.min.z !== undefined && bounds.max.z !== undefined && (
            <Typography variant="caption" sx={{ color: "grey.500", fontFamily: "monospace", fontSize: 9 }}>
              z: {bounds.min.z === bounds.max.z ? bounds.min.z : `${bounds.min.z}–${bounds.max.z}`}
            </Typography>
          )}
          {hasTAxis && bounds.min.t !== undefined && bounds.max.t !== undefined && (
            <Typography
              variant="caption"
              sx={{ color: "grey.500", fontFamily: "monospace", fontSize: 9, ml: hasZAxis ? 0.5 : 0 }}
            >
              t: {bounds.min.t === bounds.max.t ? bounds.min.t : `${bounds.min.t}–${bounds.max.t}`}
            </Typography>
          )}
        </Box>

        {/* Action icons */}
        <Tooltip title="Go to ROI">
          <IconButton size="small" onClick={onGoTo} sx={{ color: "grey.400", p: 0.25 }}>
            <MyLocation sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Copy coordinates">
          <IconButton size="small" onClick={onCopy} sx={{ color: "grey.400", p: 0.25 }}>
            <ContentCopy sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit ROI">
          <IconButton size="small" onClick={onEdit} sx={{ color: isEditing ? "primary.main" : "grey.400", p: 0.25 }}>
            <Edit sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete ROI">
          <IconButton size="small" onClick={() => setConfirmOpen(true)} sx={{ color: "grey.500", p: 0.25 }}>
            <Delete sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </>
  );
}
