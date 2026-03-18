import { Grid, TextField, Typography } from "@mui/material";
import React from "react";

import type { ImageBounds } from "../state";

interface RoiCoordinateFieldsProps {
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  z1: string;
  z2: string;
  onX1Change: (v: string) => void;
  onY1Change: (v: string) => void;
  onX2Change: (v: string) => void;
  onY2Change: (v: string) => void;
  onZ1Change: (v: string) => void;
  onZ2Change: (v: string) => void;
  hasZAxis: boolean;
  zInfo: { zMax: number } | null;
  imageBounds: ImageBounds | null;
}

const fieldSx = { color: "#fff", fontSize: 12 };

export default function RoiCoordinateFields({
  x1, y1, x2, y2, z1, z2,
  onX1Change, onY1Change, onX2Change, onY2Change, onZ1Change, onZ2Change,
  hasZAxis, zInfo, imageBounds,
}: RoiCoordinateFieldsProps) {
  return (
    <>
      {/* ---- Top-left ---- */}
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
              input: { sx: fieldSx },
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
              input: { sx: fieldSx },
              htmlInput: { min: 0, max: imageBounds?.yMax },
            }}
          />
        </Grid>
      </Grid>

      {/* ---- Bottom-right ---- */}
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
              input: { sx: fieldSx },
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
              input: { sx: fieldSx },
              htmlInput: { min: 0, max: imageBounds?.yMax },
            }}
          />
        </Grid>
      </Grid>

      {/* ---- Z range (only when data has a Z axis) ---- */}
      {hasZAxis && zInfo && (
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
                  input: { sx: fieldSx },
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
                  input: { sx: fieldSx },
                  htmlInput: { min: 0, max: zInfo.zMax },
                }}
              />
            </Grid>
          </Grid>
        </>
      )}
    </>
  );
}
