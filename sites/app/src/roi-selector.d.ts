/**
 * Type declaration for the optional @biongff/roi-selector plugin.
 * This ensures TypeScript doesn't error when the package is not installed.
 */
declare module "@biongff/roi-selector" {
  import type * as React from "react";
  export const RoiSelector: React.FC;
}
