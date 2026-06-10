import React, { useMemo, useState } from "react";

import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";

import { COLORSCALES } from "../constants/colorscales";
import { type ColourProps } from "../hooks";
import { type CategoricalObservation, type Observation } from "../anndata";
import { getColor } from "../utils";
import { Legend } from "./Legend";

// @TODO: fix styling (width)
const CategoricalCol = ({ col, showColor = false }: { col: CategoricalObservation, showColor: boolean }) => {
  const [open, setOpen] = useState(false);
  const { categories } = col;

  return (
    <Box>
      <Box onClick={() => setOpen(!open)} sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <FormControlLabel
          control={<Radio size="small" onClick={(e) => e.stopPropagation()} />}
          label={col.name}
          key={col.name}
          value={col.name}
        />
        {open ? <ExpandLess /> : <ExpandMore />}
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {categories.length > 100 && (
          <Alert severity="warning" variant="outlined">
            Truncated to 100 categories
          </Alert>
        )}
        <List>
          {categories.slice(0, 100).map((cat, i) => (
            <ListItem key={cat} sx={{ pl: 4 }} disablePadding>
              {showColor && (
                <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      bgcolor: `rgba(${getColor({ value: i / (categories.length - 1), colorscale: COLORSCALES.Accent })})`,
                    }}
                  />
                </ListItemIcon>
              )}
              <ListItemText primary={cat} />
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Box>
  );
};

const NumericalCol = ({ col }: { col: { name: string } }) => {
  return <FormControlLabel control={<Radio size="small" />} label={col.name} key={col.name} value={col.name} />;
};
interface ObservationControlsProps {
  observations: Observation[],
  selectedObservation?: string,
  onObservationSelect: Function,
  legendData?: ColourProps
}

export const ObsSelect = ({ observations, selectedObservation, onObservationSelect, legendData }: ObservationControlsProps) => {


  const legend = useMemo(() => {
    if (legendData) {
      return <Legend min={legendData.min} max={legendData.max} colorscale={legendData?.colorscale} />;
    } else {
      <></>
    }
  }, [legendData]);


  return (
    <Box
      sx={{
        width: 250,
        height: "100%",
        minHeight: 250,
        zIndex: 1,
      }}
    >
      <Stack sx={{ height: "100%" }}>
        Observations
        <Box sx={{ overflowY: "auto", overflowX: "hidden" }}>
          <FormControl sx={{ width: "100%" }}>
            <RadioGroup value={selectedObservation} onChange={(e) => onObservationSelect(e.target.value)}>
              <Divider>Categorical</Divider>
              {observations && observations.filter((obs) => 'categories' in obs).map((col) => (
                <CategoricalCol key={col.name} col={col as CategoricalObservation} showColor={selectedObservation === col.name} />
              ))}
              <Divider>Numerical</Divider>
              {observations && observations.filter((obs) => !('categories' in obs)).map((col) => (
                <NumericalCol key={col.name} col={col} />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>
        {!!selectedObservation && legend}
      </Stack>
    </Box>
  );
};
