import { Grid, TextField, Typography } from "@mui/material";
import React from "react";

import type { CoordKey, CoordValues } from "../hooks/useRoiFields";
import type { ImageBounds } from "../state";

interface RoiCoordinateFieldsProps {
  coords: CoordValues;
  onCoordChange: (key: CoordKey, value: string) => void;
  roiName: string;
  onRoiNameChange: (value: string) => void;
  hasZAxis: boolean;
  hasTAxis: boolean;
  zInfo: { zMax: number } | null;
  tInfo: { tMax: number } | null;
  imageBounds: ImageBounds | null;
}

// Font size is set on the inner <input> only: setting it on the root shrinks the outline notch below the label width.
const fieldSx = { color: "#fff", "& .MuiInputBase-input": { fontSize: 12 } };
const captionSx = { color: "grey.400", display: "block", mb: 1 };

/** Format a physical coordinate for display in labels (up to 2 dp). */
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function RoiCoordinateFields({
  coords,
  onCoordChange,
  roiName,
  onRoiNameChange,
  hasZAxis,
  hasTAxis,
  zInfo,
  tInfo,
  imageBounds,
}: RoiCoordinateFieldsProps) {
  const unit = imageBounds?.spatialUnit || "";
  const unitLabel = unit ? ` (${unit})` : "";

  return (
    <>
      {/* ---- Unit indicator ---- */}
      {unit && (
        <Typography variant="caption" sx={{ color: "grey.500", mb: 0.5, display: "block" }}>
          Coordinates in <b>{unit}</b>
        </Typography>
      )}

      {/* ---- ROI Name ---- */}
      <TextField
        label="ROI name"
        size="small"
        value={roiName}
        onChange={(e) => onRoiNameChange(e.target.value)}
        fullWidth
        placeholder="roi_0"
        slotProps={{ input: { sx: fieldSx } }}
        sx={{ mb: 1 }}
      />

      {/* ---- Top-left ---- */}
      <Typography variant="caption" sx={captionSx}>
        Top-left (x₁, y₁)
      </Typography>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={imageBounds ? `x₁ (${fmt(imageBounds.xMin)}–${fmt(imageBounds.xMax)})` : "x₁"}
            size="small"
            value={coords.x1}
            onChange={(e) => onCoordChange("x1", e.target.value)}
            fullWidth
            slotProps={{
              input: { sx: fieldSx },
              htmlInput: { inputMode: "decimal" },
            }}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={imageBounds ? `y₁ (${fmt(imageBounds.yMin)}–${fmt(imageBounds.yMax)})` : "y₁"}
            size="small"
            value={coords.y1}
            onChange={(e) => onCoordChange("y1", e.target.value)}
            fullWidth
            slotProps={{
              input: { sx: fieldSx },
              htmlInput: { inputMode: "decimal" },
            }}
          />
        </Grid>
      </Grid>

      {/* ---- Bottom-right ---- */}
      <Typography variant="caption" sx={captionSx}>
        Bottom-right (x₂, y₂)
      </Typography>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={imageBounds ? `x₂ (${fmt(imageBounds.xMin)}–${fmt(imageBounds.xMax)})` : "x₂"}
            size="small"
            value={coords.x2}
            onChange={(e) => onCoordChange("x2", e.target.value)}
            fullWidth
            slotProps={{
              input: { sx: fieldSx },
              htmlInput: { inputMode: "decimal" },
            }}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label={imageBounds ? `y₂ (${fmt(imageBounds.yMin)}–${fmt(imageBounds.yMax)})` : "y₂"}
            size="small"
            value={coords.y2}
            onChange={(e) => onCoordChange("y2", e.target.value)}
            fullWidth
            slotProps={{
              input: { sx: fieldSx },
              htmlInput: { inputMode: "decimal" },
            }}
          />
        </Grid>
      </Grid>

      {/* ---- Z range (only when data has a Z axis) ---- */}
      {hasZAxis && zInfo && (
        <>
          <Typography variant="caption" sx={captionSx}>
            Z range (slice)
          </Typography>
          <Grid container spacing={1} sx={{ mb: 1 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={`z₁ (0–${zInfo.zMax})`}
                size="small"
                value={coords.z1}
                onChange={(e) => onCoordChange("z1", e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: fieldSx },
                  htmlInput: { inputMode: "numeric" },
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={`z₂ (0–${zInfo.zMax})`}
                size="small"
                value={coords.z2}
                onChange={(e) => onCoordChange("z2", e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: fieldSx },
                  htmlInput: { inputMode: "numeric" },
                }}
              />
            </Grid>
          </Grid>
        </>
      )}

      {/* ---- T range (only when data has a T axis) ---- */}
      {hasTAxis && tInfo && (
        <>
          <Typography variant="caption" sx={captionSx}>
            T range (frame)
          </Typography>
          <Grid container spacing={1} sx={{ mb: 1 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={`t₁ (0–${tInfo.tMax})`}
                size="small"
                value={coords.t1}
                onChange={(e) => onCoordChange("t1", e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: fieldSx },
                  htmlInput: { inputMode: "numeric" },
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={`t₂ (0–${tInfo.tMax})`}
                size="small"
                value={coords.t2}
                onChange={(e) => onCoordChange("t2", e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: fieldSx },
                  htmlInput: { inputMode: "numeric" },
                }}
              />
            </Grid>
          </Grid>
        </>
      )}
    </>
  );
}
