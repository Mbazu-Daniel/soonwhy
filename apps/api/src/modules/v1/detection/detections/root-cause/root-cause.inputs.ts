import {
  CRITICAL_PATH_TOLERANCE_MS,
  ERROR_STATUS_CODE,
  MAX_RANKING_ERRORS,
} from "./root-cause.inputs.constants";
import type { SpanRecord } from "./root-cause.inputs.types";
import type { ErrorData, RankingInput, TraceSpan } from "./root-cause.ranker.types";

type Dependencies = NonNullable<RankingInput["dependencyMap"]>;

export interface RankingInputs {
  traces: TraceSpan[][];
  errors: ErrorData[];
  errorsObserved: boolean;
  dependencyMap: Dependencies;
}

const startOf = (span: SpanRecord) => Date.parse(span.timestamp);
const endOf = (span: SpanRecord) => startOf(span) + span.duration;

export function isErrorSpan(span: SpanRecord): boolean {
  const code = span.statusCode;
  if (code === undefined || code === "") return false;
  return Number(code) >= ERROR_STATUS_CODE || /error/i.test(String(code));
}

function childrenByParent(spans: SpanRecord[]): Map<string, SpanRecord[]> {
  const known = new Set(spans.map((span) => span.spanId));
  const children = new Map<string, SpanRecord[]>();
  for (const span of spans) {
    if (!span.parentSpanId || !known.has(span.parentSpanId)) continue;
    const list = children.get(span.parentSpanId) ?? [];
    list.push(span);
    children.set(span.parentSpanId, list);
  }
  return children;
}

export function criticalPathSpanIds(spans: SpanRecord[]): Set<string> {
  const children = childrenByParent(spans);
  const known = new Set(spans.map((span) => span.spanId));
  const critical = new Set<string>();

  const walk = (span: SpanRecord) => {
    critical.add(span.spanId);
    let cursor = endOf(span);
    const latestFirst = [...(children.get(span.spanId) ?? [])].sort((a, b) => endOf(b) - endOf(a));
    for (const child of latestFirst) {
      if (endOf(child) <= cursor + CRITICAL_PATH_TOLERANCE_MS) {
        walk(child);
        cursor = startOf(child);
      }
    }
  };

  for (const span of spans) {
    if (!span.parentSpanId || !known.has(span.parentSpanId)) walk(span);
  }
  return critical;
}

export function buildDependencyMap(traces: SpanRecord[][]): Dependencies {
  const callees = new Map<string, Set<string>>();
  const callers = new Map<string, Set<string>>();
  const services = new Set<string>();

  for (const spans of traces) {
    const byId = new Map(spans.map((span) => [span.spanId, span]));
    for (const span of spans) {
      services.add(span.service);
      const parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
      if (!parent || parent.service === span.service) continue;
      (callees.get(parent.service) ?? callees.set(parent.service, new Set()).get(parent.service)!).add(span.service);
      (callers.get(span.service) ?? callers.set(span.service, new Set()).get(span.service)!).add(parent.service);
    }
  }

  const map: Dependencies = new Map();
  for (const service of services) {
    map.set(service, {
      upstream: [...(callees.get(service) ?? [])],
      downstream: [...(callers.get(service) ?? [])],
    });
  }
  return map;
}

function toErrors(traces: SpanRecord[][]): ErrorData[] {
  return traces
    .flat()
    .filter(isErrorSpan)
    .map((span) => ({
      timestamp: new Date(endOf(span)).toISOString(),
      serviceName: span.service,
      traceId: span.traceId,
      errorMessage: span.exceptionMessage || span.statusMessage || "span status ERROR",
    }))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(0, MAX_RANKING_ERRORS);
}

function toTraceSpans(spans: SpanRecord[]): TraceSpan[] {
  const critical = criticalPathSpanIds(spans);
  return spans.map((span) => ({
    spanId: span.spanId,
    serviceName: span.service,
    operationName: span.name,
    duration: span.duration,
    startTime: startOf(span),
    parentSpanId: span.parentSpanId || undefined,
    isCriticalPath: critical.has(span.spanId),
  }));
}

export function buildRankingInputs(traces: SpanRecord[][]): RankingInputs {
  const usable = traces.filter((spans) => spans.length > 0);
  return {
    traces: usable.map(toTraceSpans),
    errors: toErrors(usable),
    errorsObserved: usable.length > 0,
    dependencyMap: buildDependencyMap(usable),
  };
}
