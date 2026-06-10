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
        onClick={() => onSelect(items[index].name, 'feature')}
        selected={items[index].matrixIndex === selectedIndex}
      >
        <ListItemText primary={items[index].name} />
      </ListItemButton>
    </ListItem>
  );
};
export const FeatureSelect = ({ featureNames, selectedFeatureIndex, onFeatureSelect, legendData }: { featureNames: string[], selectedFeatureIndex?: string, onFeatureSelect: Function, legendData?: ColourProps }) => {
  const [searchTerm, setSearchTerm] = useState("");


  const items = useMemo(() => {
    const allItems = featureNames.map((name: string, index: number) => {
      return {
        name: name,
        matrixIndex: index
      }
    })
    if (!searchTerm) {
      return allItems
    }
    return allItems.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  }, [featureNames, searchTerm])

  const legend = useMemo(() => {
    if (legendData && legendData.colorscale) {
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
          rowCount={items.length}
          rowHeight={25}
          //@ts-expect-error
          rowProps={{
            items: items,
            onSelect: onFeatureSelect,
            selectedIndex: Number(selectedFeatureIndex),
          }}
        />
        {legend}
      </Stack>
    </Box>
  );
};
