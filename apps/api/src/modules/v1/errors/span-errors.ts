import { SPAN_ERROR_STATUS } from "./error.constants";
import type { ErrorLogSource, SpanErrorSource } from "./error.types";

export function hasException(span: SpanErrorSource): boolean {
  return Boolean(span.exceptionType || span.exceptionMessage);
}

function messageOf(span: SpanErrorSource): string {
  if (hasException(span)) {
    return [span.exceptionType, span.exceptionMessage].filter(Boolean).join(": ");
  }
  return span.statusMessage || span.name || "Span failed";
}

export function spanToErrorSource(span: SpanErrorSource): ErrorLogSource {
  const exceptionType = span.exceptionType || span.errorType || "";
  return {
    id: span.id ?? span.eventId ?? `${span.traceId}:${span.spanId}`,
    timestamp: span.timestamp,
    service: span.service,
    level: "error",
    message: messageOf(span),
    traceId: span.traceId,
    spanId: span.spanId,
    stackTrace: span.exceptionStacktrace ?? "",
    attributes: {
      ...span.attributes,
      ...(exceptionType ? { "exception.type": exceptionType } : {}),
      "span.name": span.name ?? "",
    },
  };
}

export function isErrorSpan(span: SpanErrorSource): boolean {
  return Number(span.statusCode) === SPAN_ERROR_STATUS || hasException(span);
}
