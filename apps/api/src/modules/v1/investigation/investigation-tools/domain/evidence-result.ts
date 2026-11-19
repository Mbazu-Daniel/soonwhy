import type { EvidenceResult } from "./investigation-tools.types";

function base(): Pick<EvidenceResult<never>, "observedAt" | "trust"> {
  return { observedAt: new Date().toISOString(), trust: "untrusted_telemetry" };
}

export function available<T>(data: T, truncated = false): EvidenceResult<T> {
  return { ...base(), status: "available", truncated, data };
}

export function empty<T>(reason: string): EvidenceResult<T> {
  return { ...base(), status: "empty", truncated: false, reason, data: null };
}

export function unavailable<T>(reason: string): EvidenceResult<T> {
  return { ...base(), status: "unavailable", truncated: false, reason, data: null };
}

export async function gather<T>(
  run: () => Promise<{ items: T[]; truncated?: boolean } | T[]>,
  emptyReason: string,
): Promise<EvidenceResult<T[]>> {
  try {
    const result = await run();
    const items = Array.isArray(result) ? result : result.items;
    const truncated = Array.isArray(result) ? false : (result.truncated ?? false);
    return items.length === 0 ? empty(emptyReason) : available(items, truncated);
  } catch {
    return unavailable("The query failed. This is not the same as no results; retry or narrow the range.");
  }
}
