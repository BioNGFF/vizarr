import { CropFree } from "@mui/icons-material";
import { Box, Collapse, IconButton, Snackbar, Tooltip, Typography } from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useState } from "react";

import { setZSliceAtom, useViewState, viewportAtom } from "@biongff/vizarr";

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
    x1,
    y1,
    x2,
    y2,
    z1,
    z2,
    onX1Change,
    onY1Change,
    onX2Change,
    onY2Change,
    onZ1Change,
    onZ2Change,
    hasZAxis,
    zInfo,
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
  const [, setViewState] = useViewState();
  const viewport = useAtomValue(viewportAtom);
  const setZSlice = useSetAtom(setZSliceAtom);

  /** Navigate the viewer to a saved ROI (XY + Z) and make it visible. */
  const handleGoToSavedRoi = (roi: SavedRoi) => {
    if (!viewport) return;
    const b = normalizeRoiBounds(roi);
    const roiWidth = b.x2 - b.x1;
    const roiHeight = b.y2 - b.y1;
    if (roiWidth === 0 || roiHeight === 0) return;
    const padding = 40;
    const zoom = Math.log2(
      Math.min((viewport.width - 2 * padding) / roiWidth, (viewport.height - 2 * padding) / roiHeight),
    );
    setViewState({
      zoom,
      target: [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2],
      width: viewport.width,
      height: viewport.height,
    });
    if (hasZAxis && zInfo) {
      // Only jump Z if the current slice is outside the ROI's Z range.
      if (zInfo.zValue < b.z1 || zInfo.zValue > b.z2) {
        setZSlice(b.z1);
      }
    }
    if (!roi.visible) {
      // reuse the atom setter via handleToggleVisibility — ROI is currently hidden
      handleToggleVisibility(roi.id);
    }
  };

  // ---- Clipboard ----
  const roiToPayload = (roi: SavedRoi): Record<string, number> => {
    const b = normalizeRoiBounds(roi);
    const payload: Record<string, number> = { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
    if (hasZAxis) {
      payload.z1 = b.z1;
      payload.z2 = b.z2;
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
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              z1={z1}
              z2={z2}
              onX1Change={onX1Change}
              onY1Change={onY1Change}
              onX2Change={onX2Change}
              onY2Change={onY2Change}
              onZ1Change={onZ1Change}
              onZ2Change={onZ2Change}
              hasZAxis={hasZAxis}
              zInfo={zInfo}
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
