const STATUS_ATTRIBUTES = ["http.response.status_code", "http.status_code"] as const;
const MIN_HTTP_STATUS = 100;
const MAX_HTTP_STATUS = 599;

export function httpStatusCodeOf(attributes: Record<string, unknown>): number | undefined {
  for (const key of STATUS_ATTRIBUTES) {
    const value = Number(attributes[key]);
    if (Number.isInteger(value) && value >= MIN_HTTP_STATUS && value <= MAX_HTTP_STATUS) return value;
  }
  return undefined;
}
