import * as path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const source = process.env.VIZARR_DATA || "https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr";

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      // In development, resolve the workspace packages to their sources so that changes
      // are picked up without a rebuild. Production builds use the published `dist`.
      ...(mode === "development"
        ? {
            "@biongff/vizarr": path.resolve(__dirname, "../../viewer/src/index.tsx"),
            "@biongff/anndata-zarr/dist/anndata-zarr.css": path.resolve(__dirname, "../../anndata-zarr/src/index.css"),
            "@biongff/anndata-zarr": path.resolve(__dirname, "../../anndata-zarr/src/index.ts"),
            "@biongff/roi-selector": path.resolve(__dirname, "../../roi-selector/src/index.tsx"),
          }
        : {}),
    },
  },
  server: { open: `?source=${source}` },
}));
