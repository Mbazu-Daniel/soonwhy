export const EVENT_ID_FIELD = "eventId";
export const EVENT_LOOKUP_AGGREGATION = "found";
export const DUPLICATE_AGGREGATION = "duplicates";
export const DUPLICATE_MIN_DOC_COUNT = 2;
export const DUPLICATE_REPORT_SIZE = 1000;
export const QUICKWIT_DEFAULT_COMMIT_TIMEOUT_SECS = 60;

export type EventLookupRange = { startTimestamp: number; endTimestamp: number };

export function escapeQueryTerm(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function eventIdQuery(eventIds: readonly string[]): string {
  return eventIds.map((id) => `${EVENT_ID_FIELD}:"${escapeQueryTerm(id)}"`).join(" OR ");
}

export function eventLookupAggregation(size: number): Record<string, unknown> {
  return { [EVENT_LOOKUP_AGGREGATION]: { terms: { field: EVENT_ID_FIELD, size } } };
}

export function foundEventIds(response: { num_hits: number; aggregations?: Record<string, unknown> }): Set<string> {
  const buckets = (response.aggregations?.[EVENT_LOOKUP_AGGREGATION] as { buckets?: unknown } | undefined)?.buckets;
  if (Array.isArray(buckets)) return new Set(buckets.map((bucket) => String((bucket as { key: unknown }).key)));
  if (response.num_hits === 0) return new Set();
  throw new Error("Quickwit lookup returned hits without the expected aggregation");
}

export function commitTimeoutOf(indexConfig: Record<string, unknown> | undefined): number {
  const value = (indexConfig?.indexing_settings as { commit_timeout_secs?: unknown } | undefined)?.commit_timeout_secs;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : QUICKWIT_DEFAULT_COMMIT_TIMEOUT_SECS;
}

export type DuplicateReport = { documents: number; duplicateEventIds: number; extraCopies: number; truncated: boolean };

export function duplicateAggregation(size: number): Record<string, unknown> {
  return { [DUPLICATE_AGGREGATION]: { terms: { field: EVENT_ID_FIELD, size, min_doc_count: DUPLICATE_MIN_DOC_COUNT } } };
}

export function duplicateReport(
  response: { num_hits: number; aggregations?: Record<string, unknown> },
  size: number,
): DuplicateReport {
  const aggregation = response.aggregations?.[DUPLICATE_AGGREGATION] as { buckets?: unknown } | undefined;
  const buckets = aggregation?.buckets;
  if (!Array.isArray(buckets)) {
    if (response.num_hits === 0) return { documents: 0, duplicateEventIds: 0, extraCopies: 0, truncated: false };
    throw new Error("Quickwit duplicate check returned hits without the expected aggregation");
  }
  const extraCopies = buckets.reduce((total: number, bucket) => total + Math.max(0, Number((bucket as { doc_count: unknown }).doc_count) - 1), 0);
  return { documents: response.num_hits, duplicateEventIds: buckets.length, extraCopies, truncated: buckets.length >= size };
}
