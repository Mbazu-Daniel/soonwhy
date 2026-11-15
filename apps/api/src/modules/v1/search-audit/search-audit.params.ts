const AUDITED_PARAMS = ["q", "service", "level", "traceId", "spanId", "from", "to", "format", "name", "status", "minDuration", "maxDuration"] as const;

export const MAX_PARAM_LENGTH = 500;

export function auditParams(query: Record<string, unknown> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!query) return result;
  for (const key of AUDITED_PARAMS) {
    const value = query[key];
    if (typeof value !== "string" || value === "") continue;
    result[key] = value.slice(0, MAX_PARAM_LENGTH);
  }
  return result;
}
