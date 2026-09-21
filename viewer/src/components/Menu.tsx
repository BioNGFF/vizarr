import { Add, ExpandMore, Remove } from "@mui/icons-material";
import { Box, Grid, IconButton } from "@mui/material";
import { useAtomValue } from "jotai";
import React, { useReducer } from "react";

import { SourceDataContext } from "../hooks";
import { sourceInfoAtomAtoms } from "../state";
import LayerController from "./LayerController";

/** Height of the fade at a scrollable edge, in CSS pixels. */
const FADE = 14;

/** Tallest the scroll area may get before the list starts scrolling. */
const MAX_HEIGHT = 500;

/**
 * Vertical space the panel occupies outside the scroll area: the 5px top
 * offset, the ~24px collapse button, 5px of bottom padding, and enough margin
 * that the panel never sits flush against the bottom of the window.
 *
 * `dvh` rather than `vh` so a mobile browser's retracting URL bar doesn't push
 * the panel off-screen.
 */
const PANEL_CHROME = 60;

/**
 * Tracks whether a scroll container has content hidden above or below.
 *
 * Observes the content wrapper as well as the container: collapsing a layer or
 * adding a channel changes `scrollHeight` without resizing either the container
 * or the window, so a resize listener alone would go stale.
 */
function useScrollOverflow() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = React.useState({ up: false, down: false });

  const sync = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    // 1px of slack: fractional layout leaves scrollTop a hair short of the end.
    const up = scrollTop > 1;
    const down = scrollTop + clientHeight < scrollHeight - 1;
    // Bail on an unchanged result; this runs on every scroll event.
    setOverflow((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
  }, []);

  React.useEffect(() => {
    sync();
    const observer = new ResizeObserver(sync);
    if (containerRef.current) observer.observe(containerRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [sync]);

  const scrollDown = React.useCallback(() => {
    // Overlap by a fifth of a page so you keep your place across the jump.
    const el = containerRef.current;
    el?.scrollBy({ top: el.clientHeight * 0.8, behavior: "smooth" });
  }, []);

  return { containerRef, contentRef, onScroll: sync, scrollDown, ...overflow };
}

/** Masks out the edges that have more content behind them, and only those. */
function edgeMask(up: boolean, down: boolean) {
  if (!up && !down) return undefined;
  const top = up ? `transparent 0, #000 ${FADE}px` : "#000 0";
  const bottom = down ? `#000 calc(100% - ${FADE}px), transparent 100%` : "#000 100%";
  return `linear-gradient(to bottom, ${top}, ${bottom})`;
}

function Menu(props: { open?: boolean }) {
  const sourceAtoms = useAtomValue(sourceInfoAtomAtoms);
  const [hidden, toggle] = useReducer((v) => !v, !(props.open ?? true));
  const { containerRef, contentRef, onScroll, scrollDown, up, down } = useScrollOverflow();
  const mask = edgeMask(up, down);
  return (
    <Box
      sx={{
        zIndex: 1,
        position: "absolute",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderRadius: "5px",
        left: "5px",
        top: "5px",
      }}
      style={{ padding: `0px 5px ${hidden ? 0 : 5}px 5px` }}
    >
      <Grid container direction="column" alignItems="flex-start">
        <IconButton style={{ backgroundColor: "transparent", padding: 0 }} onClick={toggle}>
          {hidden ? <Add /> : <Remove />}
        </IconButton>
        {/* Anchors the chevron outside the scroll container, so it neither
            scrolls with the content nor gets dimmed by the container's mask. */}
        <Box sx={{ position: "relative" }} style={{ display: hidden ? "none" : "block" }}>
          <Box
            ref={containerRef}
            onScroll={onScroll}
            sx={{
              maxHeight: `min(${MAX_HEIGHT}px, calc(100dvh - ${PANEL_CHROME}px))`,
              overflowX: "hidden",
              overflowY: "scroll",
              "&::-webkit-scrollbar": {
                display: "none",
                background: "transparent",
              },
              scrollbarWidth: "none",
              flexDirection: "column",
              // The scrollbar is hidden by design, so a fade is the only cue that
              // the list continues. Applied to the container, not the content, so
              // it stays pinned to the edge while the content scrolls under it.
              maskImage: mask,
              WebkitMaskImage: mask,
              display: "flex",
            }}
          >
            {/* Wrapper exists so the ResizeObserver can watch the content height. */}
            <div ref={contentRef} style={{ display: "flex", flexDirection: "column" }}>
              {sourceAtoms.map((sourceAtom) => (
                <SourceDataContext.Provider key={`${sourceAtom}`} value={sourceAtom}>
                  <LayerController />
                </SourceDataContext.Provider>
              ))}
            </div>
          </Box>
          {down && (
            // Covers the faded strip only. That region is already unreadable,
            // so swallowing clicks there costs nothing and the click does the
            // thing you wanted anyway.
            <button
              type="button"
              aria-label="Scroll down for more layers"
              onClick={scrollDown}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: FADE + 4,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                border: "none",
                padding: 0,
                background: "transparent",
                color: "rgba(255, 255, 255, 0.85)",
                cursor: "pointer",
                lineHeight: 0,
              }}
            >
              <ExpandMore style={{ fontSize: 16 }} />
            </button>
          )}
        </Box>
      </Grid>
    </Box>
  );
}

export default Menu;
