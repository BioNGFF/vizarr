import * as path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const source = process.env.VIZARR_DATA || "https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.1/6001253.zarr";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        ...(mode === "development"
          ? {
              "@biongff/vizarr": path.resolve(__dirname, "../../viewer/src/index.tsx"),
              "@biongff/roi-selector": path.resolve(__dirname, "../../roi-selector/src/index.tsx"),
            }
          : {}),
      },
    },
    server: { open: `?source=${source}` },
  };
});
