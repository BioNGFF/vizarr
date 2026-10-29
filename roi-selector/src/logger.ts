import { createLogger } from "@biongff/vizarr";

/**
 * Namespaced so the plugin's output can be isolated in the console filter, and so it
 * inherits the viewer's rule that debug/info are stripped from production builds.
 */
export const log = createLogger("vizarr:roi");
