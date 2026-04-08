import { ExpandMore, SelectAll } from "@mui/icons-material";
import { Box, Button, Collapse, Divider, Typography } from "@mui/material";
import React from "react";

import type { SavedRoi } from "../state";
import SavedRoiItem from "./SavedRoiItem";

interface SavedRoiListProps {
  savedRois: SavedRoi[];
  hasZAxis: boolean;
  hasTAxis: boolean;
  editingRoiId: string | null;
  roiMenuOpen: boolean;
  onToggleOpen: () => void;
  onToggleVisibility: (id: string) => void;
  onGoTo: (roi: SavedRoi) => void;
  onCopy: (roi: SavedRoi) => void;
  onEdit: (roi: SavedRoi) => void;
  onDelete: (id: string) => void;
  onCopyAll: () => void;
}

export default function SavedRoiList({
  savedRois,
  hasZAxis,
  hasTAxis,
  editingRoiId,
  roiMenuOpen,
  onToggleOpen,
  onToggleVisibility,
  onGoTo,
  onCopy,
  onEdit,
  onDelete,
  onCopyAll,
}: SavedRoiListProps) {
  if (savedRois.length === 0) return null;

  return (
    <>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", my: 1 }} />

      {/* Collapsible header */}
      <Box
        onClick={onToggleOpen}
        sx={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          "&:hover": { opacity: 0.8 },
        }}
      >
        <ExpandMore
          sx={{
            transform: roiMenuOpen ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s",
            color: "#fff",
            fontSize: 18,
            mr: 0.5,
          }}
        />
        <Typography variant="caption" sx={{ color: "#fff", fontWeight: 600 }}>
          Saved ROIs ({savedRois.length})
        </Typography>
      </Box>

      <Collapse in={roiMenuOpen}>
        <Box sx={{ mt: 0.5 }}>
          {savedRois.map((roi) => (
            <SavedRoiItem
              key={roi.id}
              roi={roi}
              hasZAxis={hasZAxis}
              hasTAxis={hasTAxis}
              isEditing={editingRoiId === roi.id}
              onToggleVisibility={() => onToggleVisibility(roi.id)}
              onGoTo={() => onGoTo(roi)}
              onCopy={() => onCopy(roi)}
              onEdit={() => onEdit(roi)}
              onDelete={() => onDelete(roi.id)}
            />
          ))}

          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={onCopyAll}
            startIcon={<SelectAll sx={{ fontSize: 14 }} />}
            sx={{
              textTransform: "none",
              fontSize: 10,
              mt: 0.5,
              color: "grey.400",
              borderColor: "grey.700",
            }}
          >
            Copy all ROIs
          </Button>
        </Box>
      </Collapse>
    </>
  );
}
