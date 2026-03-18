/**
 * Type declaration for the optional @biongff/roi-selector plugin.
 * The optionalDeps Vite plugin substitutes an empty module when the
 * package is disabled in pnpm-workspace.yaml.
 */
declare module "@biongff/roi-selector" {
  import type * as React from "react";
  export const RoiSelector: React.FC;
}

/**
 * Compile-time constant injected by Vite's `define` option.
 * `true` when `roi-selector` is active in pnpm-workspace.yaml.
 */
declare const __ROI_AVAILABLE__: boolean;
