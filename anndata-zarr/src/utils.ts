import _ from "lodash";

import { COLORSCALES } from "./constants/colorscales";
import { type ColourProps } from "./hooks";


const parseHexColor = (color: string) => {
  const r = Number.parseInt(color?.substring(1, 3), 16);
  const g = Number.parseInt(color?.substring(3, 5), 16);
  const b = Number.parseInt(color?.substring(5, 7), 16);

  return [r, g, b];
};

const interpolateColor = (color1: string, color2: string, factor: number) => {
  const [r1, g1, b1] = parseHexColor(color1);
  const [r2, g2, b2] = parseHexColor(color2);

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return [r, g, b];
};

const computeColor = (colormap: string[], value: number) => {
  if (!colormap || Number.isNaN(value)) {
    return [0, 0, 0, 255];
  }
  if (value <= 0) {
    return parseHexColor(colormap[0]);
  }
  if (value >= 1) {
    return parseHexColor(colormap[colormap.length - 1]);
  }
  const index1 = Math.floor(value * (colormap.length - 1));
  const index2 = Math.ceil(value * (colormap.length - 1));
  const factor = (value * (colormap.length - 1)) % 1;
  return interpolateColor(colormap[index1], colormap[index2], factor);
};

export const getColor = ({ value, colorscale = COLORSCALES.Viridis }: { value: number, colorscale?: string[] }) => {
  return [...computeColor(colorscale, value), 255];
};

export const getColors = ({ data, max, min, colorscale, categories }: { data: number[], max: number, min: number, colorscale?: string[], categories?: string[] }) => {
  return _.map(data, (v: number, i: number) => ({
    labelValue: i + 1,
    rgba: getColor({ value: (v - min) / (max - min), colorscale }),
    value: categories ? (categories[v] ?? v) : v,
  }));
};
