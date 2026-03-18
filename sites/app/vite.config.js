import * as fs from "node:fs";
import * as path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const source = process.env.VIZARR_DATA || "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.1/6001253.zarr";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      ...(mode === "development"
        ? {
            "@biongff/vizarr": path.resolve(__dirname, "../../viewer/src/index.tsx"),
          }
        : {}),
    },
    load(id) {
      if (id.startsWith("\0optional:")) {
        return "export default {}";
      }
    },
  },
}));

export default defineConfig(({ mode }) => {
  const wsPath = path.resolve(__dirname, "../../pnpm-workspace.yaml");
  const wsContent = fs.readFileSync(wsPath, "utf-8");
  const roiActive = isWorkspaceFolderActive(wsContent, "roi-selector");

  const disabledPackages = new Set();
  if (!roiActive) disabledPackages.add("@biongff/roi-selector");

  return {
    plugins: [optionalDeps(disabledPackages), react()],
    define: {
      __ROI_AVAILABLE__: JSON.stringify(roiActive),
    },
    resolve: {
      alias: {
        ...(mode === "development"
          ? {
              "@biongff/vizarr": path.resolve(__dirname, "../../viewer/src/index.tsx"),
              ...(roiActive
                ? { "@biongff/roi-selector": path.resolve(__dirname, "../../roi-selector/src/index.tsx") }
                : {}),
            }
          : {}),
      },
    },
    server: { open: `?source=${source}` },
  };
});
