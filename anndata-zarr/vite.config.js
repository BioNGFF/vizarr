import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dts({ rollupTypes: true, tsconfigPath: "./tsconfig.json" })],
  build: {
    // outDir: path.resolve(__dirname, '../dist'),
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "BiongffAnndataZarr",
      formats: ["es", "cjs"],
      fileName: (format) => `biongff-anndata-zarr.${format}.js`,
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
