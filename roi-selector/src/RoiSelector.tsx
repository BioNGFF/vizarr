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
  currentImageBoundsAtom,
  viewportAtom,
  setZSliceAtom,
} from "@biongff/vizarr";

import {
  roiDrawStateAtom,
  savedRoisAtom,
  pendingRoiAtom,
  normalizeRoiBounds,
  clampToBounds,
  nextAvailableColor,
  type SavedRoi,
} from "./state";

import { useRoiDeckExtension } from "./useRoiDeckExtension";

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
  // ---- Register deck.gl extension (overlays, click/hover handlers) ----
  useRoiDeckExtension();

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
  const imageBounds = useAtomValue(currentImageBoundsAtom);
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
      const bn = normalizeRoiBounds(pendingRoi);
      const b = imageBounds ? clampToBounds(bn, imageBounds) : bn;
      setX1(String(b.x1));
      setY1(String(b.y1));
      setX2(String(b.x2));
      setY2(String(b.y2));
      setZ1(String(b.z1));
      setZ2(String(b.z2));
    }
  }, [pendingRoi]);

  /**
   * Sync text field changes back to the atom layer so the overlay updates live.
   *
   * Uses functional updaters to avoid stale-closure issues: the latest atom
   * state is always received via the `prev` argument rather than captured
   * from the enclosing render scope.
   */
  const syncFieldsToPending = React.useCallback(
    (nx1: string, ny1: string, nx2: string, ny2: string, nz1: string, nz2: string) => {
      const px1 = Number(nx1);
      const py1 = Number(ny1);
      const px2 = Number(nx2);
      const py2 = Number(ny2);
      if ([px1, py1, px2, py2].some(Number.isNaN)) return;

      const newCorner1: [number, number] = [Math.min(px1, px2), Math.min(py1, py2)];
      const newCorner2: [number, number] = [Math.max(px1, px2), Math.max(py1, py2)];

      // When editing a saved ROI, update it in-place for live overlay feedback.
      if (editingRoiId) {
        setSavedRois((prev) =>
          prev.map((r) => {
            if (r.id !== editingRoiId) return r;
            return {
              ...r,
              corner1: newCorner1,
              corner2: newCorner2,
              z1: nz1 !== "" ? Number(nz1) : r.z1,
              z2: nz2 !== "" ? Number(nz2) : r.z2,
            };
          }),
        );
        return;
      }

      // Update the pending ROI using a functional updater so we never
      // read a stale `pendingRoi` from the closure.
      setPendingRoi((prev) => {
        if (!prev) return prev;
        internalUpdate.current = true;
        return {
          corner1: newCorner1,
          corner2: newCorner2,
          z1: nz1 !== "" ? Number(nz1) : prev.z1,
          z2: nz2 !== "" ? Number(nz2) : prev.z2,
        };
      });
    },
    [editingRoiId, setSavedRois, setPendingRoi],
  );

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
    const nz1 = z1 !== "" ? Number(z1) : pendingRoi.z1;
    const nz2 = z2 !== "" ? Number(z2) : pendingRoi.z2;
    const raw = { corner1: [nx1, ny1] as [number, number], corner2: [nx2, ny2] as [number, number], z1: nz1, z2: nz2 };
    const b = imageBounds ? clampToBounds(normalizeRoiBounds(raw), imageBounds) : normalizeRoiBounds(raw);
    setSavedRois((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        corner1: [b.x1, b.y1],
        corner2: [b.x2, b.y2],
        z1: b.z1,
        z2: b.z2,
        color: nextAvailableColor(prev),
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
    setSavedRois((prev) => prev.filter((r) => r.id !== id));
    if (editingRoiId === id) setEditingRoiId(null);
  };

  /** Toggle visibility of a saved ROI. */
  const handleToggleVisibility = (id: string) => {
    setSavedRois((prev) => prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));
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
    const bn = normalizeRoiBounds(roi);
    const b = imageBounds ? clampToBounds(bn, imageBounds) : bn;
    setX1(String(b.x1));
    setY1(String(b.y1));
    setX2(String(b.x2));
    setY2(String(b.y2));
    setZ1(String(b.z1));
    setZ2(String(b.z2));
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
      setSavedRois((prev) => prev.map((r) => (r.id === editingRoiId ? orig : r)));
    }
    editOriginal.current = null;
    setEditingRoiId(null);
  };

  // Write-only atom to change the Z slice for all sources.
  const setZSlice = useSetAtom(setZSliceAtom);

  /** Navigate the viewer to a specific saved ROI (XY + Z) and ensure visibility. */
  const handleGoToSavedRoi = (roi: SavedRoi) => {
    if (!viewport) return;
    const b = normalizeRoiBounds(roi);
    const roiWidth = b.x2 - b.x1;
    const roiHeight = b.y2 - b.y1;
    if (roiWidth === 0 || roiHeight === 0) return;
    const padding = 40;
    const availableWidth = viewport.width - 2 * padding;
    const availableHeight = viewport.height - 2 * padding;
    const zoom = Math.log2(Math.min(availableWidth / roiWidth, availableHeight / roiHeight));
    setViewState({
      zoom,
      target: [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2],
      width: viewport.width,
      height: viewport.height,
    });
    // Navigate to the ROI's Z plane (use the start of its range)
    if (hasZAxis) {
      setZSlice(b.z1);
    }
    // Ensure the ROI is visible
    if (!roi.visible) {
      setSavedRois((prev) => prev.map((r) => (r.id === roi.id ? { ...r, visible: true } : r)));
    }
  };

  /** Build a clipboard payload from a ROI. */
  const roiToPayload = (roi: SavedRoi): Record<string, number> => {
    const b = normalizeRoiBounds(roi);
    const payload: Record<string, number> = { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
    if (hasZAxis) {
      payload.z1 = b.z1;
      payload.z2 = b.z2;
    }
    return payload;
  };

  /** Copy a single ROI's coordinates to clipboard. */
  const handleCopySingleRoi = (roi: SavedRoi) => {
    navigator.clipboard.writeText(JSON.stringify(roiToPayload(roi))).then(() => setSnackOpen(true));
  };

  /** Copy all saved ROIs to clipboard as a JSON array. */
  const handleCopyAllRois = () => {
    const arr = savedRois.map(roiToPayload);
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
                label={imageBounds ? `x₁ (0–${imageBounds.xMax})` : "x₁"}
                size="small"
                type="number"
                value={x1}
                onChange={(e) => onX1Change(e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: { color: "#fff", fontSize: 12 } },
                  htmlInput: { min: 0, max: imageBounds?.xMax },
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={imageBounds ? `y₁ (0–${imageBounds.yMax})` : "y₁"}
                size="small"
                type="number"
                value={y1}
                onChange={(e) => onY1Change(e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: { color: "#fff", fontSize: 12 } },
                  htmlInput: { min: 0, max: imageBounds?.yMax },
                }}
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
                label={imageBounds ? `x₂ (0–${imageBounds.xMax})` : "x₂"}
                size="small"
                type="number"
                value={x2}
                onChange={(e) => onX2Change(e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: { color: "#fff", fontSize: 12 } },
                  htmlInput: { min: 0, max: imageBounds?.xMax },
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={imageBounds ? `y₂ (0–${imageBounds.yMax})` : "y₂"}
                size="small"
                type="number"
                value={y2}
                onChange={(e) => onY2Change(e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: { color: "#fff", fontSize: 12 } },
                  htmlInput: { min: 0, max: imageBounds?.yMax },
                }}
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
                    const b = normalizeRoiBounds(roi);
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
