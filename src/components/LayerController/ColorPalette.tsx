import { Container, IconButton } from "@mui/material";
import { Lens } from "@mui/icons-material";
import React from "react";
import { COLORS, hexToRGB } from "../../utils";

const RGB_COLORS: [string, [number, number, number]][] = Object.entries(COLORS).map(([name, hex]) => [
  name,
  hexToRGB(hex),
]);
function ColorPalette({
  handleChange,
}: {
  handleChange: (c: [number, number, number]) => void;
}) {
  return (
    <Container
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "2px",
      }}
      aria-label="color-swatch"
    >
      {RGB_COLORS.map(([name, rgb]) => {
        return (
          <IconButton
            sx={{ padding: "3px", width: "16px", height: "16px" }}
            key={name}
            onClick={() => handleChange(rgb)}
          >
            <Lens fontSize="small" style={{ color: `rgb(${rgb})` }} />
          </IconButton>
        );
      })}
    </Container>
  );
}

export default ColorPalette;
