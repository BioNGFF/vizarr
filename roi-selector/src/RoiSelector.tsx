import { CropFree } from "@mui/icons-material";
import { Box, Collapse, IconButton, Snackbar, Tooltip, Typography } from "@mui/material";
import React, { useState } from "react";

import { useViewerPlugin } from "@biongff/vizarr";

import RoiCoordinateFields from "./components/RoiCoordinateFields";
import RoiDrawControls from "./components/RoiDrawControls";
import SavedRoiList from "./components/SavedRoiList";
import { useRoiFields } from "./hooks/useRoiFields";
import { type SavedRoi, normalizeRoiBounds } from "./state";
import { useRoiDeckExtension } from "./useRoiDeckExtension";

/**
 * RoiSelector — a collapsible panel that lets you:
 *
 *  1. Draw ROI rectangles directly on the image canvas.
 *  2. Type in top-left (x₁, y₁) and bottom-right (x₂, y₂) image coordinates.
 *  3. Save, edit, delete, and copy ROIs.
 *  4. Navigate the viewer to a saved ROI.
 *
 * State management is handled by `useRoiFields`.
 * deck.gl interaction (overlays, clicks) is handled by `useRoiDeckExtension`.
 * This component is responsible only for panel layout, navigation, and clipboard.
 */
function RoiSelector() {
  useRoiDeckExtension();

  const {
    coords,
    onCoordChange,
    roiName,
    onRoiNameChange,
    hasZAxis,
    hasTAxis,
    zInfo,
    tInfo,
    imageBounds,
    isDrawing,
    roiDrawState,
    pendingRoi,
    savedRois,
    editingRoiId,
    handleToggleDraw,
    handleSaveRoi,
    handleDiscardRoi,
    handleDeleteRoi,
    handleToggleVisibility,
    handleEditRoi,
    handleUpdateRoi,
    handleCancelEdit,
  } = useRoiFields();

  // ---- Panel toggle state ----
  const [open, setOpen] = useState(false);
  const [roiMenuOpen, setRoiMenuOpen] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);

  // ---- Viewer navigation ----
  const { viewport, setViewState, setZSlice, setTSlice } = useViewerPlugin();

  /** Navigate the viewer to a saved ROI (XY + Z) and make it visible. */
  const handleGoToSavedRoi = (roi: SavedRoi) => {
    if (!viewport) return;
    const bounds = normalizeRoiBounds(roi);
    const roiWidth = bounds.max.x - bounds.min.x;
    const roiHeight = bounds.max.y - bounds.min.y;
    if (roiWidth === 0 || roiHeight === 0) return;
    const padding = 40;
    const availW = Math.max(viewport.width - 2 * padding, 1);
    const availH = Math.max(viewport.height - 2 * padding, 1);
    const zoom = Math.log2(Math.min(availW / roiWidth, availH / roiHeight));
    setViewState({
      zoom,
      target: [(bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2],
      width: viewport.width,
      height: viewport.height,
    });
    if (hasZAxis && zInfo && bounds.min.z !== undefined && bounds.max.z !== undefined) {
      // Only jump Z if the current slice is outside the ROI's Z range.
      if (zInfo.zValue < bounds.min.z || zInfo.zValue > bounds.max.z) {
        setZSlice(bounds.min.z);
      }
    }
    if (hasTAxis && tInfo && bounds.min.t !== undefined && bounds.max.t !== undefined) {
      // Only jump T if the current frame is outside the ROI's T range.
      if (tInfo.tValue < bounds.min.t || tInfo.tValue > bounds.max.t) {
        setTSlice(bounds.min.t);
      }
    }
    if (!roi.visible) {
      // reuse the atom setter via handleToggleVisibility — ROI is currently hidden
      handleToggleVisibility(roi.id);
    }
  };

  // ---- Clipboard ----
  const roiToPayload = (roi: SavedRoi): Record<string, string | number> => {
    const bounds = normalizeRoiBounds(roi);
    const payload: Record<string, string | number> = {
      name: roi.name,
      x1: bounds.min.x,
      y1: bounds.min.y,
      x2: bounds.max.x,
      y2: bounds.max.y,
    };
    if (hasZAxis && bounds.min.z !== undefined && bounds.max.z !== undefined) {
      payload.z1 = bounds.min.z;
      payload.z2 = bounds.max.z;
    }
    if (hasTAxis && bounds.min.t !== undefined && bounds.max.t !== undefined) {
      payload.t1 = bounds.min.t;
      payload.t2 = bounds.max.t;
    }
    return payload;
  };

  const handleCopySingleRoi = (roi: SavedRoi) => {
    navigator.clipboard.writeText(JSON.stringify(roiToPayload(roi))).then(() => setSnackOpen(true));
  };

  const handleCopyAllRois = () => {
    navigator.clipboard.writeText(JSON.stringify(savedRois.map(roiToPayload), null, 2)).then(() => setSnackOpen(true));
  };

  // ---- Render ----
  return (
    <Box
      sx={{
        zIndex: 1,
        position: "absolute",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderRadius: "5px",
        right: "5px",
        top: "5px",
        padding: "4px 8px",
        minWidth: 210,
      }}
    >
      <Tooltip title="Select Region of Interest">
        <IconButton size="small" onClick={() => setOpen((prev) => !prev)} sx={{ color: "#fff" }}>
          <CropFree fontSize="small" />
          <Typography variant="caption" sx={{ ml: 0.5, color: "#fff" }}>
            ROI Selection
          </Typography>
        </IconButton>
      </Tooltip>

      <Collapse in={open}>
        <Box sx={{ mt: 1 }}>
          {(pendingRoi || editingRoiId) && (
            <RoiCoordinateFields
              coords={coords}
              onCoordChange={onCoordChange}
              roiName={roiName}
              onRoiNameChange={onRoiNameChange}
              hasZAxis={hasZAxis}
              hasTAxis={hasTAxis}
              zInfo={zInfo}
              tInfo={tInfo}
              imageBounds={imageBounds}
            />
          )}

          <RoiDrawControls
            editingRoiId={editingRoiId}
            pendingRoi={pendingRoi}
            isDrawing={isDrawing}
            roiDrawState={roiDrawState}
            onToggleDraw={handleToggleDraw}
            onSave={handleSaveRoi}
            onDiscard={handleDiscardRoi}
            onUpdate={handleUpdateRoi}
            onCancelEdit={handleCancelEdit}
          />

          <SavedRoiList
            savedRois={savedRois}
            hasZAxis={hasZAxis}
            hasTAxis={hasTAxis}
            editingRoiId={editingRoiId}
            roiMenuOpen={roiMenuOpen}
            onToggleOpen={() => setRoiMenuOpen((prev) => !prev)}
            onToggleVisibility={handleToggleVisibility}
            onGoTo={handleGoToSavedRoi}
            onCopy={handleCopySingleRoi}
            onEdit={handleEditRoi}
            onDelete={handleDeleteRoi}
            onCopyAll={handleCopyAllRois}
          />
        </Box>
      </Collapse>

      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        message="ROI coordinates copied!"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

export default RoiSelector;
