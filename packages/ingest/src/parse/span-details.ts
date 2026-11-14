import { nanoToMs } from "./time";
import {
  EXCEPTION_EVENT_NAME,
  MAX_EXCEPTION_MESSAGE_LENGTH,
  MAX_EXCEPTION_STACK_LENGTH,
  MAX_SPAN_EVENTS,
  MAX_SPAN_LINKS,
} from "./span-details.constants";
import type {
  SpanDetailFields,
  SpanDetailSanitizers,
  SpanEventRow,
  SpanExceptionFields,
} from "./span-details.types";
import type { ParsedSpan } from "../interfaces";

function eventTimestamp(timeUnixNano: string): string {
  const millis = nanoToMs(timeUnixNano);
  return Number.isFinite(millis) && millis > 0 ? new Date(millis).toISOString() : "";
}

function exceptionOf(
  span: ParsedSpan,
  sanitize: SpanDetailSanitizers,
): SpanExceptionFields {
  const event = span.events.find((item) => item.name === EXCEPTION_EVENT_NAME);
  const attributes = event?.attributes ?? {};
  const type = String(attributes["exception.type"] ?? span.attributes["error.type"] ?? "");
  const message = String(attributes["exception.message"] ?? "");
  const stack = String(attributes["exception.stacktrace"] ?? "");
  return {
    ...(type ? { exceptionType: type.slice(0, MAX_EXCEPTION_MESSAGE_LENGTH) } : {}),
    ...(message
      ? { exceptionMessage: sanitize.text(message.slice(0, MAX_EXCEPTION_MESSAGE_LENGTH)) }
      : {}),
    ...(stack
      ? { exceptionStacktrace: sanitize.text(stack.slice(0, MAX_EXCEPTION_STACK_LENGTH)) }
      : {}),
  };
}

export function spanDetailFields(
  span: ParsedSpan,
  sanitize: SpanDetailSanitizers,
): SpanDetailFields {
  const events: SpanEventRow[] = span.events.slice(0, MAX_SPAN_EVENTS).map((event) => ({
    name: event.name,
    timestamp: eventTimestamp(event.timeUnixNano),
    attributes: sanitize.attributes(
      event.name === EXCEPTION_EVENT_NAME
        ? { ...event.attributes, "exception.stacktrace": undefined }
        : event.attributes,
    ),
  }));
  return {
    attributes: sanitize.attributes(span.attributes),
    resourceAttributes: sanitize.attributes(span.resource.attributes),
    events,
    links: span.links.slice(0, MAX_SPAN_LINKS).map((link) => ({
      traceId: link.traceId,
      spanId: link.spanId,
      attributes: sanitize.attributes(link.attributes),
    })),
    ...exceptionOf(span, sanitize),
  };
}
