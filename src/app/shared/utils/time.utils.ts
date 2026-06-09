import { TIME_CONSTANTS } from "./constants";

export function formatTimeAgo(timestamp: number): string {
  const age = Date.now() - timestamp;
  if (age < TIME_CONSTANTS.ONE_SECOND_MS) return "< 1s";
  if (age < TIME_CONSTANTS.ONE_MINUTE_MS)
    return `${Math.floor(age / TIME_CONSTANTS.ONE_SECOND_MS)}s ago`;
  if (age < TIME_CONSTANTS.ONE_HOUR_MS)
    return `${Math.floor(age / TIME_CONSTANTS.ONE_MINUTE_MS)}m ago`;
  return `${Math.floor(age / TIME_CONSTANTS.ONE_HOUR_MS)}h ago`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < TIME_CONSTANTS.ONE_MINUTE_MS) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / TIME_CONSTANTS.ONE_MINUTE_MS)}m ${Math.floor((ms % TIME_CONSTANTS.ONE_MINUTE_MS) / 1000)}s`;
}
