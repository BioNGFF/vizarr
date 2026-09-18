// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Glob pattern to include all package configs or directories
    projects: ["anndata-zarr", "viewer", "roi-selector"],
    // Note: test options set here do not reach the projects above; each project is
    // configured by its own vite config. Timeouts live there.
  },
});
