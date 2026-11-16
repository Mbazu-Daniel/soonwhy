import { HTTP_ERROR_FLOOR, HTTP_SERVER_ERROR_FLOOR, SPAN_ERROR_STATUS } from "./error.constants";
import type { ErrorLogSource, SpanErrorSource } from "./error.types";

export function hasException(span: SpanErrorSource): boolean {
  return Boolean(span.exceptionType || span.exceptionMessage);
}

function httpFailure(span: SpanErrorSource): number {
  const status = Number(span.httpStatusCode);
  return Number.isInteger(status) && status >= HTTP_ERROR_FLOOR ? status : 0;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function httpMessage(span: SpanErrorSource, status: number): string {
  const attributes = span.attributes ?? {};
  const method = textOf(attributes["http.request.method"]) || textOf(attributes["http.method"]);
  const target = textOf(attributes["http.route"]) || span.name || "";
  return `${method} ${target} ${status}`.replace(/\s+/g, " ").trim();
}

function messageOf(span: SpanErrorSource): string {
  if (hasException(span)) {
    return [span.exceptionType, span.exceptionMessage].filter(Boolean).join(": ");
  }
  const status = httpFailure(span);
  if (status && Number(span.statusCode) !== SPAN_ERROR_STATUS && !span.statusMessage) {
    return httpMessage(span, status);
  }
  return span.statusMessage || span.name || "Span failed";
}

export function spanToErrorSource(span: SpanErrorSource): ErrorLogSource {
  const exceptionType = span.exceptionType || span.errorType || "";
  const status = httpFailure(span);
  const serverFailure = Number(span.statusCode) === SPAN_ERROR_STATUS || status >= HTTP_SERVER_ERROR_FLOOR;
  return {
    id: span.id ?? span.eventId ?? `${span.traceId}:${span.spanId}`,
    timestamp: span.timestamp,
    service: span.service,
    environment: span.environment,
    level: serverFailure || hasException(span) ? "error" : "warn",
    message: messageOf(span),
    traceId: span.traceId,
    spanId: span.spanId,
    stackTrace: span.exceptionStacktrace ?? "",
    attributes: {
      ...span.attributes,
      ...(status ? { "http.status_code": String(status) } : {}),
      ...(exceptionType ? { "exception.type": exceptionType } : {}),
      "span.name": span.name ?? "",
    },
  };
}

export function isErrorSpan(span: SpanErrorSource): boolean {
  return Number(span.statusCode) === SPAN_ERROR_STATUS || hasException(span) || httpFailure(span) > 0;
}
