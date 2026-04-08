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

const fieldSx = { color: "#fff", fontSize: 12 };

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
  return (
    <>
      {/* ---- ROI Name ---- */}
      <TextField
        label="ROI name"
        size="small"
        value={roiName}
        onChange={(e) => onRoiNameChange(e.target.value)}
        fullWidth
        placeholder="roi_0"
        slotProps={{ input: { sx: { color: "#fff", fontSize: 12 } } }}
        sx={{ mb: 1 }}
      />

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

      {/* ---- T range (only when data has a T axis) ---- */}
      {hasTAxis && tInfo && (
        <>
          <Typography variant="caption" sx={{ color: "grey.400" }}>
            T range (frame)
          </Typography>
          <Grid container spacing={1} sx={{ mb: 1 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={`t₁ (0–${tInfo.tMax})`}
                size="small"
                type="number"
                value={coords.t1}
                onChange={(e) => onCoordChange("t1", e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: fieldSx },
                  htmlInput: { min: 0, max: tInfo.tMax },
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label={`t₂ (0–${tInfo.tMax})`}
                size="small"
                type="number"
                value={coords.t2}
                onChange={(e) => onCoordChange("t2", e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: fieldSx },
                  htmlInput: { min: 0, max: tInfo.tMax },
                }}
              />
            </Grid>
          </Grid>
        </>
      )}
    </>
  );
}
