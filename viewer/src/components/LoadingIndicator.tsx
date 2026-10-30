import LinearProgress from "@mui/material/LinearProgress";
import { useAtomValue } from "jotai";
import * as React from "react";

import { isLoadingAtom } from "../state";
import { tokens } from "../theme";

/** Nothing is shown for a load that settles within this, so a quick open stays silent. */
const DELAY_MS = 400;

/** Once shown it stays at least this long, so it cannot appear as a flash. */
const MINIMUM_MS = 400;

/**
 * Whether to show a busy indicator for `active`, with the delay and minimum duration
 * that stop it flickering.
 *
 * `visible` is deliberately not a dependency: the timer that sets it must not restart
 * the effect, or showing the indicator would immediately schedule showing it again.
 */
function useDelayedBusy(active: boolean): boolean {
  const [visible, setVisible] = React.useState(false);
  const shownAt = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (active) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, DELAY_MS);
      // Clearing this is what keeps a fast load silent: it never got as far as showing.
      return () => clearTimeout(timer);
    }
    const since = shownAt.current;
    if (since === null) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(
      () => {
        shownAt.current = null;
        setVisible(false);
      },
      Math.max(0, MINIMUM_MS - (Date.now() - since)),
    );
    return () => clearTimeout(timer);
  }, [active]);

  return visible;
}

/**
 * A quiet, non-blocking signal that the viewer is fetching a source.
 *
 * It sits above the canvas rather than over it, and ignores pointer events, because a
 * slow load is far more bearable if the view can still be panned while it finishes.
 */
export default function LoadingIndicator() {
  const loading = useAtomValue(isLoadingAtom);
  const visible = useDelayedBusy(loading);

  if (!visible) {
    return null;
  }

  return (
    <LinearProgress
      // Indeterminate: the work is a few hundred small requests, so a percentage would
      // jump about without telling the user anything they can act on.
      aria-label="Loading image data"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: (theme) => theme.zIndex.tooltip + 1,
        pointerEvents: "none",
        backgroundColor: "transparent",
        "& .MuiLinearProgress-bar": {
          backgroundColor: tokens.panel.border,
        },
      }}
    />
  );
}
