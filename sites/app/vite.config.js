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
          }
        : {}),
    },
  },
}));
