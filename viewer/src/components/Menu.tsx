import { Add, ChevronLeft, ChevronRight, Fullscreen, HighlightAlt, PanTool, Remove } from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useReducer, useState } from "react";

import { SourceDataContext, useViewState } from "../hooks";
import { firstLayerFitAtom, interactionModeAtom, sourceInfoAtom, sourceInfoAtomAtoms } from "../state";
import { tokens } from "../theme";
import LayerController from "./LayerController";

/** Zoom applied per press of the zoom in/out buttons. */
const ZOOM_STEP = 0.5;

function Menu({ open, enableSelectTool = false }: { open?: boolean; enableSelectTool?: boolean }) {
  const sourceInfo = useAtomValue(sourceInfoAtom);
  const sourceAtoms = useAtomValue(sourceInfoAtomAtoms);
  const [hidden, toggle] = useReducer((v) => !v, !(open ?? true));
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [interactionMode, setInteractionMode] = useAtom(interactionModeAtom);
  const [, setViewState] = useViewState();
  const fitViewState = useAtomValue(firstLayerFitAtom);
  const activeSource = sourceInfo[0];

  const zoomBy = (delta: number) =>
    setViewState((current) => (current ? { ...current, zoom: current.zoom + delta } : current));

  const sourceDescription = useMemo(() => {
    if (!activeSource) {
      return "Load an image source to inspect and interact with spatial controls.";
    }
    const channels = activeSource.names.length;
    const dimensions = activeSource.loader[0]?.shape?.join(" x ") ?? "unknown shape";
    return `${channels} channel${channels === 1 ? "" : "s"} available. Base array shape: ${dimensions}.`;
  }, [activeSource]);

  const railButtonSx = {
    color: "common.white",
    border: `1px solid ${tokens.rail.border}`,
    borderRadius: `${tokens.rail.radius}px`,
    backgroundColor: tokens.rail.background,
    "&:hover": {
      backgroundColor: tokens.rail.hover,
    },
  };

  // Buttons grouped into one bordered stack, so only the group carries the outline.
  const railGroupSx = {
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${tokens.rail.border}`,
    borderRadius: `${tokens.rail.radius}px`,
    overflow: "hidden",
    marginTop: "10px",
  };
  const railGroupButtonSx = { ...railButtonSx, width: "100%", border: 0, borderRadius: 0 };
  const railDividerSx = { borderBottom: `1px solid ${tokens.rail.border}` };

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
          width: hidden ? 0 : { xs: 280, sm: 340 },
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
            width: { xs: 280, sm: 340 },
            backgroundColor: tokens.panel.background,
            borderRight: `2px solid ${tokens.panel.border}`,
            boxShadow: `inset -1px 0 0 ${tokens.panel.inset}`,
          }}
          aria-hidden={hidden}
        >
          <Box sx={{ px: 1, py: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {activeSource?.name ?? "Dataset"}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5, lineHeight: 1.4 }}>
              {sourceDescription}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setMetadataOpen(true)}
              sx={{ mt: 1, fontSize: "0.72rem" }}
            >
              View Full Metadata
            </Button>
          </Box>
          <Divider />
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
                background: tokens.scrollbarThumb,
                borderRadius: "8px",
              },
              scrollbarColor: `${tokens.scrollbarThumb} transparent`,
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
        {/* Only shown when a host plugin consumes the mode, so there is no inert tool. */}
        {enableSelectTool && (
          <Box sx={railGroupSx}>
            <Tooltip title="Pan" placement="right">
              <IconButton
                sx={{
                  ...railGroupButtonSx,
                  ...railDividerSx,
                  backgroundColor: interactionMode === "pan" ? tokens.rail.active : tokens.rail.background,
                }}
                onClick={() => setInteractionMode("pan")}
                aria-label="Pan the image"
                aria-pressed={interactionMode === "pan"}
              >
                <PanTool />
              </IconButton>
            </Tooltip>
            <Tooltip title="Select region of interest" placement="right">
              <IconButton
                sx={{
                  ...railGroupButtonSx,
                  backgroundColor: interactionMode === "select" ? tokens.rail.active : tokens.rail.background,
                }}
                onClick={() => setInteractionMode("select")}
                aria-label="Select a region of interest"
                aria-pressed={interactionMode === "select"}
              >
                <HighlightAlt />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        <Box sx={railGroupSx}>
          <Tooltip title="Zoom in" placement="right">
            <IconButton
              sx={{ ...railGroupButtonSx, ...railDividerSx }}
              onClick={() => zoomBy(ZOOM_STEP)}
              aria-label="Zoom in"
            >
              <Add />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom out" placement="right">
            <IconButton
              sx={{ ...railGroupButtonSx, ...railDividerSx }}
              onClick={() => zoomBy(-ZOOM_STEP)}
              aria-label="Zoom out"
            >
              <Remove />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit image to view" placement="right">
            {/* A disabled button fires no events, so Tooltip has nothing to listen on and
                warns. The span is the wrapper MUI asks for; display:flex keeps it from
                changing the rail's layout. */}
            <span style={{ display: "flex" }}>
              <IconButton
                sx={railGroupButtonSx}
                disabled={!fitViewState}
                onClick={() => fitViewState && setViewState(() => fitViewState)}
                aria-label="Fit image to view"
              >
                <Fullscreen />
              </IconButton>
            </span>
          </Tooltip>
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
              backgroundColor: tokens.code.background,
              color: tokens.code.color,
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
