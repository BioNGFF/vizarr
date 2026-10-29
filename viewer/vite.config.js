import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

import { testScope } from "../vitest.scope.js";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dts({ rollupTypes: true, tsconfigPath: "./tsconfig.json" })],
  test: {
    // Set here rather than in the root config: a project does not inherit test options
    // from the config that lists it.
    ...testScope(),
    setupFiles: ["./tests/setup.ts"],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.tsx"),
      name: "BiongffVizarr",
      formats: ["es", "cjs"],
      fileName: (format) => `biongff-vizarr.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
});
