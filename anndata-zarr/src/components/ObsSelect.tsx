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

import type { CategoricalObservation, Observation } from "../anndata";
import { COLORSCALES } from "../constants/colorscales";
import type { ColourProps, ObservationMetadata } from "../hooks";
import { getColor } from "../utils";
import { Legend } from "./Legend";

// @TODO: fix styling (width)
const CategoricalCol = ({
  name,
  categories,
  showColor = false,
}: { name: string; categories: string[]; showColor: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <Box>
      <Box onClick={() => setOpen(!open)} sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <FormControlLabel
          control={<Radio size="small" onClick={(e) => e.stopPropagation()} />}
          label={name}
          key={name}
          value={name}
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
                      bgcolor: `rgba(${getColor({
                        value: i / (categories.length - 1),
                        colorscale: COLORSCALES.Accent,
                      })})`,
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

const NumericalCol = ({ name }: { name: string }) => {
  return <FormControlLabel control={<Radio size="small" />} label={name} key={name} value={name} />;
};
interface ObservationControlsProps {
  observations: ObservationMetadata[];
  selectedObservation?: string;
  onObservationSelect: (labelIndex: string, labelType: "observation" | "feature") => void;
  legendData?: ColourProps;
}

export const ObsSelect = ({
  observations,
  selectedObservation,
  onObservationSelect,
  legendData,
}: ObservationControlsProps) => {
  const legend = useMemo(() => {
    if (legendData?.colorscale) {
      return <Legend min={legendData.min} max={legendData.max} colorscale={legendData?.colorscale} />;
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
            <RadioGroup
              value={selectedObservation}
              onChange={(e) => onObservationSelect(e.target.value, "observation")}
            >
              <Divider>Categorical</Divider>
              {observations
                ?.filter((obs) => "categories" in obs)
                .map((observation) => (
                  <CategoricalCol
                    key={observation.labelIndex}
                    name={observation.labelIndex}
                    categories={observation.categories ? observation.categories : []}
                    showColor={selectedObservation === observation.labelIndex}
                  />
                ))}
              <Divider>Numerical</Divider>
              {observations
                ?.filter((obs) => !("categories" in obs))
                .map((observation) => (
                  <NumericalCol key={observation.labelIndex} name={observation.labelIndex} />
                ))}
            </RadioGroup>
          </FormControl>
        </Box>
        {!!selectedObservation && legend}
      </Stack>
    </Box>
  );
};
