import { ContentCopy, Delete, Edit, MyLocation, VisibilityOff } from "@mui/icons-material";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import React from "react";

import { normalizeRoiBounds, type SavedRoi } from "../state";

interface SavedRoiItemProps {
  roi: SavedRoi;
  hasZAxis: boolean;
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
  isEditing,
  onToggleVisibility,
  onGoTo,
  onCopy,
  onEdit,
  onDelete,
}: SavedRoiItemProps) {
  const b = normalizeRoiBounds(roi);

  return (
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

      {/* Coordinates + Z info */}
      <Box sx={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 10,
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          ({b.x1}, {b.y1}) → ({b.x2}, {b.y2})
        </Typography>
        {hasZAxis && (
          <Typography
            variant="caption"
            sx={{ color: "grey.500", fontFamily: "monospace", fontSize: 9 }}
          >
            z: {b.z1 === b.z2 ? b.z1 : `${b.z1}–${b.z2}`}
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
        <IconButton
          size="small"
          onClick={onEdit}
          sx={{ color: isEditing ? "primary.main" : "grey.400", p: 0.25 }}
        >
          <Edit sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete ROI">
        <IconButton size="small" onClick={onDelete} sx={{ color: "grey.500", p: 0.25 }}>
          <Delete sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
