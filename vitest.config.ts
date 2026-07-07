// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Glob pattern to include all package configs or directories
    projects: ["anndata-zarr", "viewer", "roi-selector"],
    testTimeout: 10000,
  },
});
