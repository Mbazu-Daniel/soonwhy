import { DENIED_NAMES, DENIED_STATUSES } from "./organization-isolation.constants";

function statusOf(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; getStatus?: () => number };
  if (typeof candidate?.getStatus === "function") return candidate.getStatus();
  return typeof candidate?.status === "number" ? candidate.status : undefined;
}

export function isDenial(error: unknown): boolean {
  const status = statusOf(error);
  if (status !== undefined) return DENIED_STATUSES.has(status);
  return error instanceof Error && DENIED_NAMES.has(error.constructor.name);
}

export function isEmptyResult(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Set || value instanceof Map) return value.size === 0;
  return false;
}
