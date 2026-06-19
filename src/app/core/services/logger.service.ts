export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
}

const noop = () => {};

export const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  log: noop,
};
