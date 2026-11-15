import { hasException, isErrorSpan, spanToErrorSource } from "./span-errors";
import { requestToErrorSource } from "./request-errors";
import { isCoveredByLog } from "./request-coverage";
import type { ErrorLogSource, RequestErrorSource, SpanErrorSource } from "./error.types";

function newestFirst(a: ErrorLogSource, b: ErrorLogSource): number {
  return (b.timestamp ?? "").localeCompare(a.timestamp ?? "");
}

function identityOf(traceId: string | undefined, spanId: string | undefined): string {
  return traceId && spanId ? `${traceId}:${spanId}` : (spanId ?? "");
}

export function mergeErrorSources(input: {
  logs: ErrorLogSource[];
  spans: SpanErrorSource[];
  requests: RequestErrorSource[];
}): ErrorLogSource[] {
  const errorSpans = input.spans.filter(isErrorSpan);
  const primary = [
    ...input.logs,
    ...errorSpans.filter(hasException).map(spanToErrorSource),
  ];
  const primaryTraces = new Set(primary.flatMap((item) => (item.traceId ? [item.traceId] : [])));

  const secondary = new Map<string, ErrorLogSource>();
  for (const span of errorSpans.filter((item) => !hasException(item))) {
    secondary.set(identityOf(span.traceId, span.spanId), spanToErrorSource(span));
  }
  for (const request of input.requests) {
    secondary.set(identityOf(request.traceId, request.spanId ?? request.id), requestToErrorSource(request));
  }
  const extra = [...secondary.values()].filter(
    (item) => !(item.traceId && primaryTraces.has(item.traceId)) && !isCoveredByLog(item, primary),
  );
  return [...primary, ...extra].sort(newestFirst);
}
