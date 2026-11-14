export interface EntrySpan {
  traceId: string;
  name?: string;
  service?: string;
  timestamp: string;
  duration?: number | string;
  statusCode?: number | string;
}

export interface TraceListRow {
  traceId: string;
  name: string;
  rootService: string;
  rootOperation: string;
  start: string;
  end: string;
  startTime: string;
  durationMs: number;
  spanCount: number;
  errorCount: number;
  status: "ok" | "error";
}

interface CountBuckets {
  buckets?: Array<{ key: string | number; doc_count: number }>;
}

function countsOf(buckets: CountBuckets | undefined): Map<string, number> {
  return new Map((buckets?.buckets ?? []).map((bucket) => [String(bucket.key), bucket.doc_count]));
}

export function buildTraceList(
  spans: EntrySpan[],
  spanCounts: CountBuckets | undefined,
  errorCounts: CountBuckets | undefined,
): TraceListRow[] {
  const total = countsOf(spanCounts);
  const failed = countsOf(errorCounts);
  const seen = new Set<string>();
  const rows: TraceListRow[] = [];
  for (const span of spans) {
    if (seen.has(span.traceId)) continue;
    seen.add(span.traceId);
    const durationMs = Number(span.duration) || 0;
    const start = new Date(span.timestamp).toISOString();
    const errorCount = failed.get(span.traceId) ?? 0;
    rows.push({
      traceId: span.traceId,
      name: span.name ?? "",
      rootService: span.service ?? "",
      rootOperation: span.name ?? "",
      start,
      end: new Date(new Date(start).getTime() + durationMs).toISOString(),
      startTime: start,
      durationMs,
      spanCount: total.get(span.traceId) ?? 1,
      errorCount,
      status: errorCount > 0 || Number(span.statusCode ?? 0) >= 2 ? "error" : "ok",
    });
  }
  return rows;
}
