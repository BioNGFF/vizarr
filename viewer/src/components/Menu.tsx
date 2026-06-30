import { Add, ChevronLeft, ChevronRight, Fullscreen, HighlightAlt, PanTool, Remove } from "@mui/icons-material";
import { Box, Button, Dialog, DialogContent, DialogTitle, Divider, IconButton, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { useMemo, useReducer, useState } from "react";

import { SourceDataContext } from "../hooks";
import { sourceInfoAtom, sourceInfoAtomAtoms } from "../state";
import LayerController from "./LayerController";

function Menu(props: { open?: boolean }) {
  const sourceInfo = useAtomValue(sourceInfoAtom);
  const sourceAtoms = useAtomValue(sourceInfoAtomAtoms);
  const [hidden, toggle] = useReducer((v) => !v, !(props.open ?? true));
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [interactionMode, setInteractionMode] = useState<"drag" | "polygon">("drag");
  const activeSource = sourceInfo[0];

  const sourceDescription = useMemo(() => {
    if (!activeSource) {
      return "Load an image source to inspect and interact with spatial controls.";
    }
    const channels = activeSource.names.length;
    const dimensions = activeSource.loader[0]?.shape?.join(" x ") ?? "unknown shape";
    return `${channels} channel${channels === 1 ? "" : "s"} available. Base array shape: ${dimensions}.`;
  }, [activeSource]);

  const railButtonSx = {
    color: "white",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    backgroundColor: "#151515",
    "&:hover": {
      backgroundColor: "#232323",
    },
  };

  return (
    <Box
      sx={{
        zIndex: 1,
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
        pointerEvents: "none",
      }}
    >
      <Box
        sx={{
          pointerEvents: "auto",
          width: hidden ? 0 : { xs: 250, sm: 300 },
          transition: "width 220ms ease",
          overflow: "hidden",
          height: "100%",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: { xs: 250, sm: 300 },
            backgroundColor: "rgba(0, 0, 0, 0.72)",
            borderRight: "2px solid rgba(255, 255, 255, 0.38)",
            boxShadow: "inset -1px 0 0 rgba(255, 255, 255, 0.18)",
          }}
          aria-hidden={hidden}
        >
          <Box sx={{ px: 1, py: 1 }}>
            <Typography variant="subtitle2" sx={{ color: "rgba(255, 255, 255, 0.95)", fontWeight: 600 }}>
              {activeSource?.name ?? "Dataset"}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255, 255, 255, 0.72)", display: "block", mt: 0.5, lineHeight: 1.4 }}
            >
              {sourceDescription}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setMetadataOpen(true)}
              sx={{
                mt: 1,
                color: "#fff",
                borderColor: "rgba(255, 255, 255, 0.35)",
                textTransform: "none",
                fontSize: "0.72rem",
                "&:hover": {
                  borderColor: "rgba(255, 255, 255, 0.65)",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                },
              }}
            >
              View Full Metadata
            </Button>
          </Box>
          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />
          <Typography
            variant="caption"
            sx={{
              px: 1,
              py: 0.5,
              color: "rgba(255, 255, 255, 0.72)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Spatial Controls
          </Typography>
          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />
          <Box
            sx={{
              p: 1,
              height: "100%",
              minHeight: 0,
              overflowX: "hidden",
              overflowY: "auto",
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(255, 255, 255, 0.22)",
                borderRadius: "8px",
              },
              scrollbarColor: "rgba(255, 255, 255, 0.22) transparent",
            }}
          >
            {sourceAtoms.map((sourceAtom) => (
              <SourceDataContext.Provider key={`${sourceAtom}`} value={sourceAtom}>
                <LayerController />
              </SourceDataContext.Provider>
            ))}
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          p: 1,
          backgroundColor: "transparent",
        }}
      >
        <IconButton
          sx={railButtonSx}
          onClick={toggle}
          aria-label={hidden ? "Expand spatial controls" : "Collapse spatial controls"}
        >
          {hidden ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            overflow: "hidden",
            marginTop: "10px"
          }}
        >
          <IconButton
            sx={{
              ...railButtonSx,
              width: "100%",
              border: 0,
              borderRadius: 0,
              borderBottom: "1px solid #2a2a2a",
              backgroundColor: interactionMode === "drag" ? "#2f2f2f" : "#151515",
            }}
            onClick={() => setInteractionMode("drag")}
            aria-label="Interaction mode: drag"
            aria-pressed={interactionMode === "drag"}
          >
            <PanTool />
          </IconButton>
          <IconButton
            sx={{
              ...railButtonSx,
              width: "100%",
              border: 0,
              borderRadius: 0,
              backgroundColor: interactionMode === "polygon" ? "#2f2f2f" : "#151515",
            }}
            onClick={() => setInteractionMode("polygon")}
            aria-label="Interaction mode: polygon"
            aria-pressed={interactionMode === "polygon"}
          >
            <HighlightAlt />
          </IconButton>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            overflow: "hidden",
            marginTop: "10px"
          }}
        >
          <IconButton
            sx={{
              ...railButtonSx,
              width: "100%",
              border: 0,
              borderRadius: 0,
              borderBottom: "1px solid #2a2a2a",
            }}
            aria-label="Zoom in"
          >
            <Add />
          </IconButton>
          <IconButton
            sx={{
              ...railButtonSx,
              width: "100%",
              border: 0,
              borderRadius: 0,
              borderBottom: "1px solid #2a2a2a",
            }}
            aria-label="Zoom out"
          >
            <Remove />
          </IconButton>
          <IconButton
            sx={{
              width: "100%",
              border: 0,
              borderRadius: 0,
              backgroundColor: "#151515",
              "&:hover": {
                backgroundColor: "#232323",
              },
            }}
            aria-label="Reset view to full screen"
          >
            <Fullscreen />
          </IconButton>
        </Box>
      </Box>
      <Dialog open={metadataOpen} onClose={() => setMetadataOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Image Metadata</DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: "#0f1115",
              color: "#e6edf3",
              overflow: "auto",
              fontSize: "0.78rem",
              lineHeight: 1.4,
            }}
          >
            {JSON.stringify(activeSource ?? { message: "No source metadata loaded yet." }, null, 2)}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default Menu;
