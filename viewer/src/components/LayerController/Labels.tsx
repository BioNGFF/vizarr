import { RadioButtonChecked, RadioButtonUnchecked } from "@mui/icons-material";
import { Grid, IconButton } from "@mui/material";
import React from "react";

import { useLayerState, useSourceData } from "../../hooks";
import { assert } from "../../utils";
import { ControlLabel, DenseSlider, inlineIconButtonSx } from "./controls";

export default function Labels({ labelIndex }: { labelIndex: number }) {
  const [source] = useSourceData();
  const [layer, setLayer] = useLayerState();
  assert(source.labels && layer.kind === "multiscale" && layer.labels, "Missing image labels");

  const handleOpacityChange = (_: unknown, value: number | number[]) => {
    setLayer((prev) => {
      assert(prev.kind === "multiscale" && prev.labels, "Missing image labels");
      return {
        ...prev,
        labels: prev.labels.with(labelIndex, {
          ...prev.labels[labelIndex],
          layerProps: {
            ...prev.labels[labelIndex].layerProps,
            opacity: value as number,
          },
        }),
      };
    });
  };

  const { name } = source.labels[labelIndex];
  const label = layer.labels[labelIndex];
  return (
    <>
      <Grid container justifyContent="space-between" wrap="nowrap">
        <ControlLabel>{name}</ControlLabel>
      </Grid>
      <Grid container justifyContent="space-between">
        <Grid size={{ xs: 2 }}>
          <IconButton
            sx={inlineIconButtonSx}
            onClick={() => {
              setLayer((prev) => {
                assert(prev.kind === "multiscale" && prev.labels, "Missing image labels");
                return {
                  ...prev,
                  labels: prev.labels.with(labelIndex, {
                    ...prev.labels[labelIndex],
                    on: !prev.labels[labelIndex].on,
                  }),
                };
              });
            }}
          >
            {label.on ? <RadioButtonChecked /> : <RadioButtonUnchecked />}
          </IconButton>
        </Grid>
        <Grid size={{ xs: 10 }}>
          <DenseSlider value={label.layerProps.opacity} onChange={handleOpacityChange} min={0} max={1} step={0.01} />
        </Grid>
      </Grid>
    </>
  );
}
