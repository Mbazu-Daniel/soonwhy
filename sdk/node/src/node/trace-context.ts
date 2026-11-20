import { isSpanContextValid, trace } from "@opentelemetry/api";
import type { TraceCarrier } from "./trace-context.types.js";

export function withActiveTrace<T extends TraceCarrier>(input: T): T {
  if (input.traceId) return input;
  const context = trace.getActiveSpan()?.spanContext();
  if (!context || !isSpanContextValid(context)) return input;
  return { ...input, traceId: context.traceId, spanId: context.spanId };
}
