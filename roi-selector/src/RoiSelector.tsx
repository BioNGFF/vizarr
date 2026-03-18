import { ContentCopy, CropFree, Delete, Edit, ExpandMore, HighlightAlt, VisibilityOff, MyLocation, SelectAll } from "@mui/icons-material";
import {
  Box,
  Button,
  Collapse,
  Divider,
  Grid,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React, { useEffect, useRef, useState } from "react";

import {
  useViewState,
  currentZInfoAtom,
  roiDrawStateAtom,
  viewportAtom,
  savedRoisAtom,
  pendingRoiAtom,
  ROI_COLORS,
  setZSliceAtom,
  type SavedRoi,
} from "@biongff/vizarr";

/**
 * RoiSelector — a collapsible panel that lets you:
 *
 *  1. Type in top-left (x₁, y₁) and bottom-right (x₂, y₂) image
 *     coordinates and zoom the viewer to that bounding box.
 *  2. See the coordinates of the region currently in view.
 *  3. Copy those coordinates to the clipboard with one click.
 *
 * How does the zoom math work?
 * ----------------------------
 * deck.gl's OrthographicView uses a `viewState` with:
 *   • `target: [x, y]` — the image coordinate at the center of the viewport
 *   • `zoom` — a log₂ scale factor (zoom 0 = 1:1 pixels, zoom -1 = 50 %, etc.)
 *
 * Given an ROI defined by (x₁,y₁)–(x₂,y₂) and a viewport of size (W,H):
 *   target = center of the ROI = [(x₁+x₂)/2 , (y₁+y₂)/2]
 *   zoom   = log₂( min(W / roiWidth, H / roiHeight) )
 *
 * This is exactly the same formula used by `fitImageToViewport` in utils.ts,
 * except here we apply it to the user-supplied ROI rectangle instead of the
 * full image extent.
 */
function RoiSelector() {
  // -------- local UI state --------
  const [open, setOpen] = useState(false);
  const [roiMenuOpen, setRoiMenuOpen] = useState(false);
  const [editingRoiId, setEditingRoiId] = useState<string | null>(null);

  // The four text fields (kept as strings so the user can type freely):
  const [x1, setX1] = useState("");
  const [y1, setY1] = useState("");
  const [x2, setX2] = useState("");
  const [y2, setY2] = useState("");

  // Z-axis slice fields:
  const [z1, setZ1] = useState("");
  const [z2, setZ2] = useState("");

  // Snackbar feedback after clipboard copy:
  const [snackOpen, setSnackOpen] = useState(false);

  // -------- Z-axis info from first layer --------
  const zInfo = useAtomValue(currentZInfoAtom);
  const hasZAxis = zInfo !== null;

  // -------- draw-on-image state --------
  // This Jotai atom is shared with <Viewer>. Setting it to "waiting-first"
  // tells the Viewer to intercept the next two clicks as ROI corners.
  const [roiDrawState, setRoiDrawState] = useAtom(roiDrawStateAtom);
  const isDrawing = roiDrawState !== null;

  // -------- multi-ROI state --------
  const [savedRois, setSavedRois] = useAtom(savedRoisAtom);
  const [pendingRoi, setPendingRoi] = useAtom(pendingRoiAtom);

  // Track whether we are the ones updating pendingRoi (to avoid re-sync loop).
  const internalUpdate = useRef(false);

  // Fill text fields when a pending ROI is set externally (after second click in Viewer).
  useEffect(() => {
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    if (pendingRoi) {
      const { corner1, corner2, z1: pz1, z2: pz2 } = pendingRoi;
      setX1(String(Math.min(corner1[0], corner2[0])));
      setY1(String(Math.min(corner1[1], corner2[1])));
      setX2(String(Math.max(corner1[0], corner2[0])));
      setY2(String(Math.max(corner1[1], corner2[1])));
      setZ1(String(Math.min(pz1, pz2)));
      setZ2(String(Math.max(pz1, pz2)));
    }
  }, [pendingRoi]);

  /** Sync text field changes back to the pendingRoi atom so the overlay updates live. */
  const syncFieldsToPending = (
    nx1: string, ny1: string, nx2: string, ny2: string, nz1: string, nz2: string,
  ) => {
    // When editing a saved ROI, update it in-place for live overlay feedback.
    if (editingRoiId) {
      const px1 = Number(nx1);
      const py1 = Number(ny1);
      const px2 = Number(nx2);
      const py2 = Number(ny2);
      if ([px1, py1, px2, py2].some(Number.isNaN)) return;
      setSavedRois(savedRois.map((r) => {
        if (r.id !== editingRoiId) return r;
        return {
          ...r,
          corner1: [Math.min(px1, px2), Math.min(py1, py2)],
          corner2: [Math.max(px1, px2), Math.max(py1, py2)],
          z1: nz1 !== "" ? Number(nz1) : r.z1,
          z2: nz2 !== "" ? Number(nz2) : r.z2,
        };
      }));
      return;
    }
    if (!pendingRoi) return;
    const px1 = Number(nx1);
    const py1 = Number(ny1);
    const px2 = Number(nx2);
    const py2 = Number(ny2);
    if ([px1, py1, px2, py2].some(Number.isNaN)) return;
    internalUpdate.current = true;
    setPendingRoi({
      corner1: [Math.min(px1, px2), Math.min(py1, py2)],
      corner2: [Math.max(px1, px2), Math.max(py1, py2)],
      z1: nz1 !== "" ? Number(nz1) : pendingRoi.z1,
      z2: nz2 !== "" ? Number(nz2) : pendingRoi.z2,
    });
  };

  // Field change helpers — update local state AND sync to pending overlay.
  const onX1Change = (v: string) => { setX1(v); syncFieldsToPending(v, y1, x2, y2, z1, z2); };
  const onY1Change = (v: string) => { setY1(v); syncFieldsToPending(x1, v, x2, y2, z1, z2); };
  const onX2Change = (v: string) => { setX2(v); syncFieldsToPending(x1, y1, v, y2, z1, z2); };
  const onY2Change = (v: string) => { setY2(v); syncFieldsToPending(x1, y1, x2, v, z1, z2); };
  const onZ1Change = (v: string) => { setZ1(v); syncFieldsToPending(x1, y1, x2, y2, v, z2); };
  const onZ2Change = (v: string) => { setZ2(v); syncFieldsToPending(x1, y1, x2, y2, z1, v); };

  /**
   * Toggle draw mode on/off.
   * When activated, the cursor becomes a crosshair and the next two clicks
   * on the image will define the ROI corners.
   */
  const handleToggleDraw = () => {
    if (isDrawing) {
      setRoiDrawState(null); // cancel
    } else {
      setRoiDrawState("waiting-first");
    }
  };

  /** Save the pending ROI to the saved list, using the (possibly adjusted) text field values. */
  const handleSaveRoi = () => {
    if (!pendingRoi) return;
    const nx1 = Number(x1);
    const ny1 = Number(y1);
    const nx2 = Number(x2);
    const ny2 = Number(y2);
    if ([nx1, ny1, nx2, ny2].some(Number.isNaN)) return;
    const color = ROI_COLORS[savedRois.length % ROI_COLORS.length];
    const nz1 = z1 !== "" ? Number(z1) : pendingRoi.z1;
    const nz2 = z2 !== "" ? Number(z2) : pendingRoi.z2;
    setSavedRois([
      ...savedRois,
      {
        id: Math.random().toString(36).slice(2),
        corner1: [Math.min(nx1, nx2), Math.min(ny1, ny2)],
        corner2: [Math.max(nx1, nx2), Math.max(ny1, ny2)],
        z1: Math.min(nz1, nz2),
        z2: Math.max(nz1, nz2),
        color,
        visible: true,
      },
    ]);
    setPendingRoi(null);
  };

  /** Discard the pending ROI without saving. */
  const handleDiscardRoi = () => {
    setPendingRoi(null);
  };

  /** Delete a saved ROI by id. */
  const handleDeleteRoi = (id: string) => {
    setSavedRois(savedRois.filter((r) => r.id !== id));
    if (editingRoiId === id) setEditingRoiId(null);
  };

  /** Toggle visibility of a saved ROI. */
  const handleToggleVisibility = (id: string) => {
    setSavedRois(savedRois.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));
  };

  /** Stash the original values when entering edit mode so we can restore on cancel. */
  const editOriginal = useRef<SavedRoi | null>(null);

  /** Enter edit mode for a saved ROI: populate fields and track the id. */
  const handleEditRoi = (roi: SavedRoi) => {
    // Cancel any in-progress drawing or pending ROI
    if (pendingRoi) setPendingRoi(null);
    if (isDrawing) setRoiDrawState(null);
    editOriginal.current = { ...roi };
    setEditingRoiId(roi.id);
    const minX = Math.min(roi.corner1[0], roi.corner2[0]);
    const minY = Math.min(roi.corner1[1], roi.corner2[1]);
    const maxX = Math.max(roi.corner1[0], roi.corner2[0]);
    const maxY = Math.max(roi.corner1[1], roi.corner2[1]);
    setX1(String(minX));
    setY1(String(minY));
    setX2(String(maxX));
    setY2(String(maxY));
    setZ1(String(Math.min(roi.z1, roi.z2)));
    setZ2(String(Math.max(roi.z1, roi.z2)));
  };

  /** Finish editing: commit current field values (already live-synced) and exit edit mode. */
  const handleUpdateRoi = () => {
    editOriginal.current = null;
    setEditingRoiId(null);
  };

  /** Cancel editing: restore the saved ROI to its original values. */
  const handleCancelEdit = () => {
    if (editOriginal.current && editingRoiId) {
      const orig = editOriginal.current;
      setSavedRois(savedRois.map((r) => (r.id === editingRoiId ? orig : r)));
    }
    editOriginal.current = null;
    setEditingRoiId(null);
  };

  // Write-only atom to change the Z slice for all sources.
  const setZSlice = useSetAtom(setZSliceAtom);

  /** Navigate the viewer to a specific saved ROI (XY + Z) and ensure visibility. */
  const handleGoToSavedRoi = (roi: SavedRoi) => {
    if (!viewport) return;
    const minX = Math.min(roi.corner1[0], roi.corner2[0]);
    const maxX = Math.max(roi.corner1[0], roi.corner2[0]);
    const minY = Math.min(roi.corner1[1], roi.corner2[1]);
    const maxY = Math.max(roi.corner1[1], roi.corner2[1]);
    const roiWidth = maxX - minX;
    const roiHeight = maxY - minY;
    if (roiWidth === 0 || roiHeight === 0) return;
    const padding = 40;
    const availableWidth = viewport.width - 2 * padding;
    const availableHeight = viewport.height - 2 * padding;
    const zoom = Math.log2(Math.min(availableWidth / roiWidth, availableHeight / roiHeight));
    setViewState({
      zoom,
      target: [(minX + maxX) / 2, (minY + maxY) / 2],
      width: viewport.width,
      height: viewport.height,
    });
    // Navigate to the ROI's Z plane (use the start of its range)
    if (hasZAxis) {
      setZSlice(Math.min(roi.z1, roi.z2));
    }
    // Ensure the ROI is visible
    if (!roi.visible) {
      setSavedRois(savedRois.map((r) => (r.id === roi.id ? { ...r, visible: true } : r)));
    }
  };

  /** Copy a single ROI's coordinates to clipboard. */
  const handleCopySingleRoi = (roi: SavedRoi) => {
    const minX = Math.min(roi.corner1[0], roi.corner2[0]);
    const minY = Math.min(roi.corner1[1], roi.corner2[1]);
    const maxX = Math.max(roi.corner1[0], roi.corner2[0]);
    const maxY = Math.max(roi.corner1[1], roi.corner2[1]);
    const payload: Record<string, number> = { x1: minX, y1: minY, x2: maxX, y2: maxY };
    if (hasZAxis) {
      payload.z1 = Math.min(roi.z1, roi.z2);
      payload.z2 = Math.max(roi.z1, roi.z2);
    }
    navigator.clipboard.writeText(JSON.stringify(payload)).then(() => setSnackOpen(true));
  };

  /** Copy all saved ROIs to clipboard as a JSON array. */
  const handleCopyAllRois = () => {
    const arr = savedRois.map((roi) => {
      const minX = Math.min(roi.corner1[0], roi.corner2[0]);
      const minY = Math.min(roi.corner1[1], roi.corner2[1]);
      const maxX = Math.max(roi.corner1[0], roi.corner2[0]);
      const maxY = Math.max(roi.corner1[1], roi.corner2[1]);
      const payload: Record<string, number> = { x1: minX, y1: minY, x2: maxX, y2: maxY };
      if (hasZAxis) {
        payload.z1 = Math.min(roi.z1, roi.z2);
        payload.z2 = Math.max(roi.z1, roi.z2);
      }
      return payload;
    });
    navigator.clipboard.writeText(JSON.stringify(arr, null, 2)).then(() => setSnackOpen(true));
  };

  // -------- shared viewer state --------
  // `setViewState` lets us drive the camera programmatically.
  const [, setViewState] = useViewState();

  // `viewport` gives us the pixel dimensions of the deck.gl canvas so we know
  // how large the browser window is — needed to compute the zoom level.
  const viewport = useAtomValue(viewportAtom);

  // -------- handlers --------



  // -------- render --------

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
      {/* Toggle button */}
      <Tooltip title="Select Region of Interest">
        <IconButton
          size="small"
          onClick={() => setOpen((prev) => !prev)}
          sx={{ color: "#fff" }}
        >
          <CropFree fontSize="small" />
          <Typography variant="caption" sx={{ ml: 0.5, color: "#fff" }}>
            ROI Selection
          </Typography>
        </IconButton>
      </Tooltip>

      {/* Collapsible panel */}
      <Collapse in={open}>
        <Box sx={{ mt: 1 }}>
          {/* ---- Coordinate fields (shown when there is a pending ROI or editing a saved ROI) ---- */}
          {(pendingRoi || editingRoiId) && (
            <>
          {/* ---- Top-left coordinate ---- */}
          <Typography variant="caption" sx={{ color: "grey.400" }}>
            Top-left (x₁, y₁)
          </Typography>
          <Grid container spacing={1} sx={{ mb: 1 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="x₁"
                size="small"
                type="number"
                value={x1}
                onChange={(e) => onX1Change(e.target.value)}
                fullWidth
                slotProps={{ input: { sx: { color: "#fff", fontSize: 12 } } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="y₁"
                size="small"
                type="number"
                value={y1}
                onChange={(e) => onY1Change(e.target.value)}
                fullWidth
                slotProps={{ input: { sx: { color: "#fff", fontSize: 12 } } }}
              />
            </Grid>
          </Grid>

          {/* ---- Bottom-right coordinate ---- */}
          <Typography variant="caption" sx={{ color: "grey.400" }}>
            Bottom-right (x₂, y₂)
          </Typography>
          <Grid container spacing={1} sx={{ mb: 1 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="x₂"
                size="small"
                type="number"
                value={x2}
                onChange={(e) => onX2Change(e.target.value)}
                fullWidth
                slotProps={{ input: { sx: { color: "#fff", fontSize: 12 } } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="y₂"
                size="small"
                type="number"
                value={y2}
                onChange={(e) => onY2Change(e.target.value)}
                fullWidth
                slotProps={{ input: { sx: { color: "#fff", fontSize: 12 } } }}
              />
            </Grid>
          </Grid>

          {/* ---- Z-axis range (only shown when data has a Z axis) ---- */}
          {hasZAxis && (
            <>
              <Typography variant="caption" sx={{ color: "grey.400" }}>
                Z range (slice)
              </Typography>
              <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={`z₁ (0–${zInfo.zMax})`}
                    size="small"
                    type="number"
                    value={z1}
                    onChange={(e) => onZ1Change(e.target.value)}
                    fullWidth
                    slotProps={{
                      input: { sx: { color: "#fff", fontSize: 12 } },
                      htmlInput: { min: 0, max: zInfo.zMax },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={`z₂ (0–${zInfo.zMax})`}
                    size="small"
                    type="number"
                    value={z2}
                    onChange={(e) => onZ2Change(e.target.value)}
                    fullWidth
                    slotProps={{
                      input: { sx: { color: "#fff", fontSize: 12 } },
                      htmlInput: { min: 0, max: zInfo.zMax },
                    }}
                  />
                </Grid>
              </Grid>
            </>
          )}
            </>
          )}

          {/* ---- Draw / Save / Discard / Update / Cancel buttons ---- */}
          {editingRoiId ? (
            <Grid container spacing={1} sx={{ mt: 0.5, mb: 0.5 }}>
              <Grid size={{ xs: 6 }}>
                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  onClick={handleUpdateRoi}
                  color="success"
                  sx={{ textTransform: "none", fontSize: 11 }}
                >
                  Update ROI
                </Button>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={handleCancelEdit}
                  color="error"
                  sx={{ textTransform: "none", fontSize: 11 }}
                >
                  Cancel
                </Button>
              </Grid>
            </Grid>
          ) : pendingRoi ? (
            <Grid container spacing={1} sx={{ mt: 0.5, mb: 0.5 }}>
              <Grid size={{ xs: 6 }}>
                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  onClick={handleSaveRoi}
                  color="success"
                  sx={{ textTransform: "none", fontSize: 11 }}
                >
                  Save ROI
                </Button>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={handleDiscardRoi}
                  color="error"
                  sx={{ textTransform: "none", fontSize: 11 }}
                >
                  Discard
                </Button>
              </Grid>
            </Grid>
          ) : (
            <Button
              variant={isDrawing ? "contained" : "outlined"}
              size="small"
              fullWidth
              onClick={handleToggleDraw}
              startIcon={<HighlightAlt fontSize="small" />}
              color={isDrawing ? "warning" : "primary"}
              sx={{ textTransform: "none", fontSize: 11, mt: 0.5, mb: 0.5 }}
            >
              {isDrawing
                ? roiDrawState === "waiting-first"
                  ? "Click corner 1…"
                  : "Click corner 2…"
                : "Draw on image"}
            </Button>
          )}

          {/* ---- Saved ROIs (collapsible menu) ---- */}
          {savedRois.length > 0 && (
            <>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", my: 1 }} />
              <Box
                onClick={() => setRoiMenuOpen((prev) => !prev)}
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
                  {savedRois.map((roi) => {
                    const minX = Math.min(roi.corner1[0], roi.corner2[0]);
                    const minY = Math.min(roi.corner1[1], roi.corner2[1]);
                    const maxX = Math.max(roi.corner1[0], roi.corner2[0]);
                    const maxY = Math.max(roi.corner1[1], roi.corner2[1]);
                    const roiZ1 = Math.min(roi.z1, roi.z2);
                    const roiZ2 = Math.max(roi.z1, roi.z2);
                    return (
                      <Box
                        key={roi.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          py: 0.25,
                          px: 0.5,
                          borderRadius: 0.5,
                          "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" },
                        }}
                      >
                        {/* Color dot – click to toggle visibility */}
                        <Tooltip title={roi.visible ? "Hide overlay" : "Show overlay"}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleVisibility(roi.id)}
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
                            ({minX}, {minY}) → ({maxX}, {maxY})
                          </Typography>
                          {hasZAxis && (
                            <Typography
                              variant="caption"
                              sx={{ color: "grey.500", fontFamily: "monospace", fontSize: 9 }}
                            >
                              z: {roiZ1 === roiZ2 ? roiZ1 : `${roiZ1}–${roiZ2}`}
                            </Typography>
                          )}
                        </Box>
                        {/* Action icons */}
                        <Tooltip title="Go to ROI">
                          <IconButton
                            size="small"
                            onClick={() => handleGoToSavedRoi(roi)}
                            sx={{ color: "grey.400", p: 0.25 }}
                          >
                            <MyLocation sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Copy coordinates">
                          <IconButton
                            size="small"
                            onClick={() => handleCopySingleRoi(roi)}
                            sx={{ color: "grey.400", p: 0.25 }}
                          >
                            <ContentCopy sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Edit ROI">
                          <IconButton
                            size="small"
                            onClick={() => handleEditRoi(roi)}
                            sx={{ color: editingRoiId === roi.id ? "primary.main" : "grey.400", p: 0.25 }}
                          >
                            <Edit sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete ROI">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteRoi(roi.id)}
                            sx={{ color: "grey.500", p: 0.25 }}
                          >
                            <Delete sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    );
                  })}
                  {/* Copy All button */}
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    onClick={handleCopyAllRois}
                    startIcon={<SelectAll sx={{ fontSize: 14 }} />}
                    sx={{ textTransform: "none", fontSize: 10, mt: 0.5, color: "grey.400", borderColor: "grey.700" }}
                  >
                    Copy all ROIs
                  </Button>
                </Box>
              </Collapse>
            </>
          )}


        </Box>
      </Collapse>

      {/* Snackbar shown briefly after a successful copy */}
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
