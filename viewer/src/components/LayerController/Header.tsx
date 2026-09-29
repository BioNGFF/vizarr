import { ExpandMore } from "@mui/icons-material";
import { AccordionSummary, Box, Typography } from "@mui/material";
import { useSourceData } from "../../hooks";
import { tokens } from "../../theme";
import LayerFitToViewportButton from "./LayerFitToViewportButton";
import LayerInfoButton from "./LayerInfoButton";
import LayerVisibilityButton from "./LayerVisibilityButton";

const ROW_HEIGHT = 28;
const ICON_SIZE = 16;

function Header({ name }: { name: string }) {
  const [sourceData] = useSourceData();
  const label = `layer-controller-${sourceData.id}`;
  return (
    <AccordionSummary
      aria-controls={label}
      id={label}
      expandIcon={<ExpandMore />}
      sx={{
        px: 0.5,
        minHeight: ROW_HEIGHT,
        // A shade lighter than the card body so the header reads as one, matching how
        // the toolbar buttons lift on hover.
        backgroundColor: tokens.rail.hover,
        "&:hover": { backgroundColor: tokens.rail.active },
        borderBottom: `1px solid ${tokens.rail.border}`,
        "&.Mui-expanded": { minHeight: ROW_HEIGHT },
        // Caret before the content, so the disclosure sits
        // at the start of the row and the layer's own actions stay grouped at the end.
        flexDirection: "row-reverse",
        gap: 0.5,
        "& .MuiAccordionSummary-expandIconWrapper .MuiSvgIcon-root": { fontSize: ICON_SIZE },
        "& .MuiAccordionSummary-content": {
          m: 0,
          display: "flex",
          alignItems: "center",
          gap: 0.25,
          minWidth: 0,
          "&.Mui-expanded": { m: 0 },
        },
        // Sized down here rather than in each button, so the row's icons stay uniform.
        "& .MuiIconButton-root": { p: 0.5 },
        "& .MuiIconButton-root .MuiSvgIcon-root": { fontSize: ICON_SIZE },
      }}
    >
      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {name}
      </Typography>
      {/* The summary is the accordion's toggle, so anything landing in the action area
          is stopped here rather than relying on every button to remember to do it. */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.25 }}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <LayerVisibilityButton />
        <LayerFitToViewportButton />
        <LayerInfoButton />
      </Box>
    </AccordionSummary>
  );
}

export default Header;
