import * as path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      ...(mode === "development"
        ? {
            "@biongff/vizarr": path.resolve(__dirname, "../../viewer/src/index.tsx"),
            "@biongff/anndata-zarr/dist/anndata-zarr.css": path.resolve(__dirname, "../../anndata-zarr/src/index.css"),
            "@biongff/anndata-zarr": path.resolve(__dirname, "../../anndata-zarr/src/index.js"),
            "@biongff/roi-selector": path.resolve(__dirname, "../../roi-selector/src/index.tsx"),
          }
        : {}),
    },
  },
}));
