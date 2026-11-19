import { REQUEST_LOG_MATCH_WINDOW_MS } from "./error.constants";
import type { ErrorLogSource } from "./error.types";

function statusOf(item: ErrorLogSource): string {
  const attributes = item.attributes;
  if (!attributes || typeof attributes === "string") return "";
  return String(attributes["http.status_code"] ?? "");
}

function timeOf(item: ErrorLogSource): number {
  return item.timestamp ? new Date(item.timestamp).getTime() : Number.NaN;
}

export function isCoveredByLog(item: ErrorLogSource, logs: readonly ErrorLogSource[]): boolean {
  const status = statusOf(item);
  const at = timeOf(item);
  if (!status || Number.isNaN(at)) return false;
  return logs.some(
    (log) =>
      log.service === item.service &&
      statusOf(log) === status &&
      Math.abs(timeOf(log) - at) <= REQUEST_LOG_MATCH_WINDOW_MS,
  );
}
