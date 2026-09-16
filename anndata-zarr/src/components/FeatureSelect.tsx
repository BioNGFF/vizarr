import { useMemo, useState } from "react";

import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { List, type RowComponentProps } from "react-window";

import type { ColourProps } from "../hooks";
import type { LabelType } from "./AnndataController";
import { Legend } from "./Legend";

const ROW_HEIGHT = 25;

type FeatureRowProps = {
  items: string[];
  onSelect: (labelIndex: string, labelType: LabelType) => void;
  selectedName?: string;
};

const RowComponent = ({ index, items, style, onSelect, selectedName }: RowComponentProps<FeatureRowProps>) => {
  const name = items[index];
  return (
    <ListItem style={style} component="div" disablePadding>
      <ListItemButton
        style={{ height: "100%" }}
        onClick={() => onSelect(name, "feature")}
        selected={name === selectedName}
      >
        <ListItemText primary={name} />
      </ListItemButton>
    </ListItem>
  );
};

export const FeatureSelect = ({
  featureNames,
  selectedFeatureName,
  onFeatureSelect,
  legendData,
}: {
  featureNames: string[];
  selectedFeatureName?: string;
  onFeatureSelect: (labelIndex: string, labelType: LabelType) => void;
  legendData?: ColourProps;
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const items = useMemo(() => {
    if (!searchTerm) {
      return featureNames;
    }
    const term = searchTerm.toLowerCase();
    return featureNames.filter((name) => name.toLowerCase().includes(term));
  }, [featureNames, searchTerm]);

  const rowProps = useMemo<FeatureRowProps>(
    () => ({ items, onSelect: onFeatureSelect, selectedName: selectedFeatureName }),
    [items, onFeatureSelect, selectedFeatureName],
  );

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
        <TextField
          label="Search features"
          type="search"
          variant="filled"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <List rowComponent={RowComponent} rowCount={items.length} rowHeight={ROW_HEIGHT} rowProps={rowProps} />
        {legend}
      </Stack>
    </Box>
  );
};
