import React, { useEffect, useMemo, useState } from "react";

import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { List } from "react-window";

import { type ColourProps, type Feature } from "../hooks";
import { Legend } from "./Legend";

const RowComponent = ({ index, items, style, onSelect, selectedIndex }: { index: number, items: { matrixIndex: number, name: string }[], style: React.DetailedHTMLProps<React.StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>, onSelect: Function, selectedIndex?: number }) => {
  return (
    <ListItem style={style} key={index} component="div" disablePadding>
      <ListItemButton
        style={{ height: "100%" }}
        onClick={() => onSelect({ index: items[index].matrixIndex })}
        selected={items[index].matrixIndex === selectedIndex}
      >
        <ListItemText primary={items[index].name} />
      </ListItemButton>
    </ListItem>
  );
};

// List of features
// Currently selected feature to display
// onSelect to set feature

export const FeatureSelect = ({ featureNames, selectedFeature, onFeatureSelect, legendData }: { featureNames: string[], selectedFeature?: Feature, onFeatureSelect: Function, legendData?: ColourProps }) => {
  const [searchTerm, setSearchTerm] = useState("");


  const allItems = featureNames.map((name: string, index: number) => {
    return {
      name: name,
      matrixIndex: index
    }
  })

  const legend = useMemo(() => {
    if (legendData) {
      return <Legend min={legendData.min} max={legendData.max} colorscale={legendData.colorscale} />;
    } else {
      return <></>
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
        <List
          rowComponent={RowComponent}
          rowCount={allItems.length}
          rowHeight={25}
          rowProps={{
            items: allItems,
            onSelect: onFeatureSelect,
            selectedIndex: selectedFeature?.index,
          }}
        />
        {legend}
      </Stack>
    </Box>
  );
};
