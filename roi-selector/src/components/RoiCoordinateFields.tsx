import { Grid, TextField, Typography } from "@mui/material";
import React from "react";

import type { CoordKey, CoordValues } from "../hooks/useRoiFields";
import type { ImageBounds } from "../state";

interface RoiCoordinateFieldsProps {
  coords: CoordValues;
  onCoordChange: (key: CoordKey, value: string) => void;
  hasZAxis: boolean;
  zInfo: { zMax: number } | null;
  imageBounds: ImageBounds | null;
}

const fieldSx = { color: "#fff", fontSize: 12 };

export default function RoiCoordinateFields({
  coords,
  onCoordChange,
  hasZAxis,
  zInfo,
  imageBounds,
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
            value={coords.x1}
            onChange={(e) => onCoordChange("x1", e.target.value)}
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
            value={coords.y1}
            onChange={(e) => onCoordChange("y1", e.target.value)}
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
            value={coords.x2}
            onChange={(e) => onCoordChange("x2", e.target.value)}
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
            value={coords.y2}
            onChange={(e) => onCoordChange("y2", e.target.value)}
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
                value={coords.z1}
                onChange={(e) => onCoordChange("z1", e.target.value)}
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
                value={coords.z2}
                onChange={(e) => onCoordChange("z2", e.target.value)}
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
