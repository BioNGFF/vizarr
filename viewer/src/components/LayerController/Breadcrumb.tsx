import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, Link, Typography } from "@mui/material";
import { useSetAtom } from "jotai";
import React from "react";

import { useSourceData } from "../../hooks";
import { navigateBackAtom } from "../../state";

/**
 * The trail into a plate, and the way back out.
 *
 * Drilling into a well replaces the image in place rather than opening a second viewer,
 * so without this there would be no way back. Nothing is shown for an image opened
 * directly, which has no trail.
 */
export default function Breadcrumb() {
  const [sourceData] = useSourceData();
  const navigateBack = useSetAtom(navigateBackAtom);
  const { history, id, name } = sourceData;

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        rowGap: 0.25,
        px: 1,
        pt: 0.5,
        pb: 0.75,
        fontSize: 11,
      }}
    >
      {history.map((step, depth) => (
        <React.Fragment key={step.source}>
          <Link
            component="button"
            type="button"
            underline="hover"
            // Each earlier step rewinds to its own depth, so the trail cannot be left
            // describing images that are no longer above the one on screen.
            onClick={() => navigateBack({ id, depth })}
            sx={{
              fontSize: "inherit",
              color: "text.secondary",
              lineHeight: 1.4,
              "&:hover": { color: "text.primary" },
            }}
          >
            {step.name}
          </Link>
          <ChevronRightIcon sx={{ fontSize: 14, color: "text.disabled", mx: 0.25 }} />
        </React.Fragment>
      ))}
      <Typography component="span" sx={{ fontSize: "inherit", lineHeight: 1.4, color: "text.primary" }}>
        {name ?? "Image"}
      </Typography>
    </Box>
  );
}
