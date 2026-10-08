/**
 * Logging for the anndata plugin.
 *
 * Deliberately standalone rather than `createLogger` from `@biongff/vizarr`: that entry
 * point evaluates the viewer's whole bundle, which touches `window` at module scope, and
 * this package's data access is meant to run — and is tested — outside a DOM. What is
 * shared with the viewer is the convention rather than the import: the same `[namespace]`
 * tag, the same levels, and the same rule that `debug` and `info` are compiled out of
 * production builds while `warn` and `error` survive.
 */

type LogFunction = (message: string, ...details: unknown[]) => void;

const noop: LogFunction = () => {};

// Replaced with a literal at build time, so the dev-only branches are removed from the
// published bundle rather than merely skipped at runtime.
const DEV = import.meta.env?.DEV ?? false;

const tag = "[vizarr:anndata]";

export const log: {
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
} = {
  debug: DEV ? (message, ...details) => console.debug(`${tag} ${message}`, ...details) : noop,
  info: DEV ? (message, ...details) => console.info(`${tag} ${message}`, ...details) : noop,
  warn: (message, ...details) => console.warn(`${tag} ${message}`, ...details),
  error: (message, ...details) => console.error(`${tag} ${message}`, ...details),
};
