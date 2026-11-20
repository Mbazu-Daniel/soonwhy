import { quickwitSource, quickwitTerm } from "../../../../../common/quickwit/query";
import { searchTenant } from "../../../../../common/telemetry/tenant-search";
import type { QuickwitService } from "@soonwhy/shared";
import { TRACE_EXCEPTION_MAX_SPANS } from "./error.constants";
import type { SpanErrorSource, TraceException } from "./error.types";

export function pickTraceException(spans: readonly SpanErrorSource[]): TraceException | null {
  const span = spans.find((item) => item.exceptionType || item.exceptionMessage);
  if (!span) return null;
  return {
    type: span.exceptionType ?? "",
    message: span.exceptionMessage ?? "",
    stacktrace: span.exceptionStacktrace ?? "",
    spanName: span.name ?? "",
    spanId: span.spanId,
  };
}

export async function fetchTraceException(
  quickwit: Pick<QuickwitService, "search">,
  scope: { orgId: string; projectId: string },
  traceId: string,
): Promise<TraceException | null> {
  if (!traceId) return null;
  try {
    const result = await searchTenant<SpanErrorSource>(quickwit, "traces", scope, {
      filter: quickwitTerm("traceId", traceId),
      maxHits: TRACE_EXCEPTION_MAX_SPANS,
    });
    const spans = result.hits.flatMap((hit) => {
      const source = quickwitSource<SpanErrorSource>(hit);
      return source ? [source] : [];
    });
    return pickTraceException(spans);
  } catch {
    return null;
  }
}
