import type { EventLookupRange, QuickwitService } from "@soonwhy/shared";
import { RECONCILE_CHUNK_SIZE } from "./constants";

export type LookupRow = { eventId: string; timestamp?: unknown };

const MILLISECONDS_PER_SECOND = 1000;

export function lookupRange(rows: readonly LookupRow[]): EventLookupRange | undefined {
  const times = rows.map((row) => (typeof row.timestamp === "string" ? Date.parse(row.timestamp) : Number.NaN));
  if (times.length === 0 || times.some(Number.isNaN)) return undefined;
  return {
    startTimestamp: Math.floor(Math.min(...times) / MILLISECONDS_PER_SECOND),
    endTimestamp: Math.floor(Math.max(...times) / MILLISECONDS_PER_SECOND) + 1,
  };
}

export async function findExistingEventIds(
  quickwit: Pick<QuickwitService, "findEventIds">,
  indexId: string,
  rows: readonly LookupRow[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let start = 0; start < rows.length; start += RECONCILE_CHUNK_SIZE) {
    const chunk = rows.slice(start, start + RECONCILE_CHUNK_SIZE);
    const ids = await quickwit.findEventIds(indexId, chunk.map((row) => row.eventId), lookupRange(chunk));
    for (const id of ids) found.add(id);
  }
  return found;
}
