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
  // Read workspace config to determine which packages are active
  const wsPath = path.resolve(__dirname, "../../pnpm-workspace.yaml");
  const wsContent = fs.readFileSync(wsPath, "utf-8");
  const roiActive = /^\s*-\s*['"]?roi-selector['"]?\s*$/m.test(wsContent);

  return {
    plugins: [
      optionalDeps({ "@biongff/roi-selector": "roi-selector" }),
      react(),
    ],
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
