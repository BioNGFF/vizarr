/**
 * Logging for the viewer and its plugins.
 *
 * The console is a channel for developers integrating vizarr, not for the people
 * looking at the images: anything an end user needs is surfaced through the UI. So
 * `debug` and `info` describe normal operation for an integrator and are compiled out
 * of production builds, while `warn` and `error` survive, because an integrator running
 * a production build still needs to hear about them.
 *
 * Each level uses the matching console method so that the browser's own level filter
 * works: `debug` output is hidden until Verbose is enabled, which keeps detailed
 * tracing available without it having to be configured.
 */

export type LogFunction = (message: string, ...details: unknown[]) => void;

export interface Logger {
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
}

const noop: LogFunction = () => {};

// Replaced with a literal at build time, so the dev-only branches below are removed
// from the published bundle rather than merely skipped at runtime.
const DEV = import.meta.env?.DEV ?? false;

/**
 * A logger writing to the console under `[namespace]`.
 *
 * Details are passed through as separate arguments rather than interpolated into the
 * message, so the browser renders them as inspectable values instead of flattening an
 * error or an object to a string.
 */
export function createLogger(namespace: string): Logger {
  const tag = `[${namespace}]`;
  return {
    debug: DEV ? (message, ...details) => console.debug(`${tag} ${message}`, ...details) : noop,
    info: DEV ? (message, ...details) => console.info(`${tag} ${message}`, ...details) : noop,
    warn: (message, ...details) => console.warn(`${tag} ${message}`, ...details),
    error: (message, ...details) => console.error(`${tag} ${message}`, ...details),
  };
}

const defaultLogger = createLogger("vizarr");
let sink: Logger = defaultLogger;

/**
 * Route the viewer's internal logging somewhere else, e.g. a host application's own
 * logger. Passing nothing restores the console.
 *
 * This is process-wide rather than per viewer instance: the modules that log are plain
 * functions a long way from any component, and threading a logger through all of them
 * would be worse than the problem. Two viewers with different loggers in one page would
 * share the last one set.
 */
export function setLogger(logger?: Logger): void {
  sink = logger ?? defaultLogger;
}

/** The viewer's logger. Always call through this so the host's sink is respected. */
export const log: Logger = {
  debug: (message, ...details) => sink.debug(message, ...details),
  info: (message, ...details) => sink.info(message, ...details),
  warn: (message, ...details) => sink.warn(message, ...details),
  error: (message, ...details) => sink.error(message, ...details),
};
