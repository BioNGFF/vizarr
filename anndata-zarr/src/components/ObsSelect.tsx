import { useMemo, useState } from "react";

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
import type { ColourProps, ObservationMetadata } from "../hooks";
import { getColor, normalise } from "../utils";
import type { LabelType } from "./AnndataController";
import { Legend } from "./Legend";

/** Categorical columns can have an unbounded number of categories; only list this many. */
const MAX_LISTED_CATEGORIES = 100;

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
        {categories.length > MAX_LISTED_CATEGORIES && (
          <Alert severity="warning" variant="outlined">
            Truncated to {MAX_LISTED_CATEGORIES} categories
          </Alert>
        )}
        <List>
          {categories.slice(0, MAX_LISTED_CATEGORIES).map((cat, i) => (
            <ListItem key={cat} sx={{ pl: 4 }} disablePadding>
              {showColor && (
                <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      bgcolor: `rgba(${getColor({
                        value: normalise(i, 0, categories.length - 1),
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
  onObservationSelect: (labelIndex: string, labelType: LabelType) => void;
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
      return <Legend min={legendData.min} max={legendData.max} colorscale={legendData.colorscale} />;
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
