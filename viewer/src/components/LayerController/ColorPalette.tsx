import { Box, IconButton, Tooltip } from "@mui/material";
import { COLORS, hexToRGB } from "../../utils";

const RGB_COLORS: [string, [number, number, number]][] = Object.entries(COLORS).map(([name, hex]) => [
  name,
  hexToRGB(hex),
]);

const SWATCH = 18;

function ColorPalette({
  handleChange,
}: {
  handleChange: (c: [number, number, number]) => void;
}) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }} aria-label="color-swatch">
      {RGB_COLORS.map(([name, rgb]) => (
        <Tooltip title={name} key={name}>
          <IconButton
            onClick={() => handleChange(rgb)}
            aria-label={`Set channel colour to ${name}`}
            sx={{
              p: 0,
              width: SWATCH,
              height: SWATCH,
              borderRadius: "50%",
              backgroundColor: `rgb(${rgb})`,
              border: "1px solid rgba(255, 255, 255, 0.35)",
              "&:hover": {
                backgroundColor: `rgb(${rgb})`,
                borderColor: "rgba(255, 255, 255, 0.9)",
              },
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}

export default ColorPalette;
