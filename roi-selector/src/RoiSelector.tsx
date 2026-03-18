import { ContentCopy, CropFree, HighlightAlt } from "@mui/icons-material";
import {
  Box,
  Button,
  Collapse,
  Grid,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import React, { useEffect, useState } from "react";

import { useViewState, currentZInfoAtom, roiDrawStateAtom, viewportAtom } from "@biongff/vizarr";

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

  // Listen for the custom event that Viewer dispatches after the second click.
  // This is how the drawn coordinates flow back into our text fields.
  useEffect(() => {
    const handler = (e: Event) => {
      const { corner1, corner2, z1: eventZ1, z2: eventZ2 } = (e as CustomEvent).detail;
      setX1(String(corner1[0]));
      setY1(String(corner1[1]));
      setX2(String(corner2[0]));
      setY2(String(corner2[1]));
      setZ1(String(Math.min(eventZ1, eventZ2)));
      setZ2(String(Math.max(eventZ1, eventZ2)));
    };
    window.addEventListener("vizarr-roi-drawn", handler);
    return () => window.removeEventListener("vizarr-roi-drawn", handler);
  }, []);

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

  // -------- shared viewer state --------
  // `viewState` holds the current zoom / target the viewer is showing.
  // `setViewState` lets us drive the camera programmatically.
  const [viewState, setViewState] = useViewState();

  // `viewport` gives us the pixel dimensions of the deck.gl canvas so we know
  // how large the browser window is — needed to compute the zoom level.
  const viewport = useAtomValue(viewportAtom);

  // -------- handlers --------

  /**
   * Called when the user clicks "Go to ROI".
   * Parses the four coordinate fields, computes the target & zoom, and
   * pushes the new viewState into the Jotai atom (which re-renders <Viewer>).
   */
  const handleGoToRoi = () => {
    const nx1 = Number(x1);
    const ny1 = Number(y1);
    const nx2 = Number(x2);
    const ny2 = Number(y2);

    // Guard: all four must be valid numbers
    if ([nx1, ny1, nx2, ny2].some(Number.isNaN)) return;
    // Guard: the ROI must have non-zero area
    if (nx1 === nx2 || ny1 === ny2) return;
    // Guard: need viewport dimensions to compute zoom
    if (!viewport) return;

    // Ensure min/max are correct regardless of input order
    const minX = Math.min(nx1, nx2);
    const maxX = Math.max(nx1, nx2);
    const minY = Math.min(ny1, ny2);
    const maxY = Math.max(ny1, ny2);

    const roiWidth = maxX - minX;
    const roiHeight = maxY - minY;

    // A small padding (in screen-pixels) so the ROI doesn't touch the edges:
    const padding = 40;
    const availableWidth = viewport.width - 2 * padding;
    const availableHeight = viewport.height - 2 * padding;

    // The zoom level that fits the ROI inside the viewport:
    const zoom = Math.log2(Math.min(availableWidth / roiWidth, availableHeight / roiHeight));

    setViewState({
      zoom,
      target: [(minX + maxX) / 2, (minY + maxY) / 2],
      width: viewport.width,
      height: viewport.height,
    });
  };

  /**
   * Computes the bounding box of the currently visible region and returns it
   * as { x1, y1, x2, y2 } in image coordinates.
   *
   * The math is the inverse of the zoom formula:
   *   scale = 2^zoom
   *   half-visible width  = (viewportWidth  / scale) / 2
   *   half-visible height = (viewportHeight / scale) / 2
   *   top-left     = target - half-visible
   *   bottom-right = target + half-visible
   */
  const getCurrentRoi = () => {
    if (!viewState || !viewport) return null;
    const scale = 2 ** viewState.zoom;
    const halfW = viewport.width / scale / 2;
    const halfH = viewport.height / scale / 2;
    return {
      x1: Math.round(viewState.target[0] - halfW),
      y1: Math.round(viewState.target[1] - halfH),
      x2: Math.round(viewState.target[0] + halfW),
      y2: Math.round(viewState.target[1] + halfH),
    };
  };

  /**
   * Fills the text fields with the coordinates of the current view.
   * Handy for tweaking a region you navigated to manually.
   */
  const handleFillFromView = () => {
    const roi = getCurrentRoi();
    if (!roi) return;
    setX1(String(roi.x1));
    setY1(String(roi.y1));
    setX2(String(roi.x2));
    setY2(String(roi.y2));
    if (hasZAxis) {
      const currentZ = String(zInfo.zValue);
      setZ1(currentZ);
      setZ2(currentZ);
    }
  };

  /**
   * Copies the ROI coordinates (including Z if available) to the clipboard
   * as a JSON string.
   */
  const handleCopyToClipboard = () => {
    const roi = getCurrentRoi();
    if (!roi) return;
    const payload: Record<string, number> = { ...roi };
    if (hasZAxis) {
      const nz1 = z1 !== "" ? Number(z1) : zInfo.zValue;
      const nz2 = z2 !== "" ? Number(z2) : zInfo.zValue;
      payload.z1 = Math.min(nz1, nz2);
      payload.z2 = Math.max(nz1, nz2);
    }
    const text = JSON.stringify(payload);
    navigator.clipboard.writeText(text).then(() => {
      setSnackOpen(true);
    });
  };

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
                onChange={(e) => setX1(e.target.value)}
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
                onChange={(e) => setY1(e.target.value)}
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
                onChange={(e) => setX2(e.target.value)}
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
                onChange={(e) => setY2(e.target.value)}
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
                    onChange={(e) => setZ1(e.target.value)}
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
                    onChange={(e) => setZ2(e.target.value)}
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

          {/* ---- Action buttons ---- */}
          <Grid container spacing={1} sx={{ mb: 0.5 }}>
            <Grid size={{ xs: 6 }}>
              <Button
                variant="contained"
                size="small"
                fullWidth
                onClick={handleGoToRoi}
                sx={{ textTransform: "none", fontSize: 11 }}
              >
                Go to ROI
              </Button>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={handleFillFromView}
                sx={{ textTransform: "none", fontSize: 11 }}
              >
                From view
              </Button>
            </Grid>
          </Grid>

          {/* ---- Draw on image button ---- */}
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

          {/* ---- Current view info + copy button ---- */}
          {viewState && viewport && (
            <Box
              sx={{
                mt: 1,
                p: 1,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: "grey.400", display: "block" }}>
                  Current view
                </Typography>
                {(() => {
                  const roi = getCurrentRoi();
                  if (!roi) return null;
                  const zText = hasZAxis && z1 !== "" && z2 !== "" ? ` z:[${z1}–${z2}]` : "";
                  return (
                    <Typography variant="caption" sx={{ color: "#fff", fontFamily: "monospace", fontSize: 11 }}>
                      ({roi.x1}, {roi.y1}) → ({roi.x2}, {roi.y2}){zText}
                    </Typography>
                  );
                })()}
              </Box>
              <Tooltip title="Copy coordinates to clipboard">
                <IconButton size="small" onClick={handleCopyToClipboard} sx={{ color: "#fff" }}>
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
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
