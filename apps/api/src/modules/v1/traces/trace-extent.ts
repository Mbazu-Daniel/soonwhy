export interface ExtentSpan {
  traceId: string;
  timestamp: string;
  duration?: number | string;
}

export type TraceExtents = Map<string, number>;

export function traceExtents(spans: ExtentSpan[]): TraceExtents {
  const bounds = new Map<string, { start: number; end: number }>();
  for (const span of spans) {
    const start = Date.parse(span.timestamp);
    if (!Number.isFinite(start)) continue;
    const end = start + (Number(span.duration) || 0);
    const current = bounds.get(span.traceId);
    if (!current) bounds.set(span.traceId, { start, end });
    else bounds.set(span.traceId, { start: Math.min(current.start, start), end: Math.max(current.end, end) });
  }
  return new Map([...bounds].map(([id, { start, end }]) => [id, Math.max(end - start, 0)]));
}
