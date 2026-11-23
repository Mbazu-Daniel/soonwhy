import { MAX_PROPAGATION_EXAMPLES } from "./root-cause.constants";
import type { TraceSpan } from "./root-cause.ranker.types";
import type { SignalEvidence } from "./root-cause.types";

type Propagation = NonNullable<SignalEvidence["errorPropagation"]>;

const ORIGIN_BASE_SHARE = 0.5;
const REACH_SHARE = 0.5;
const MAX_INCONCLUSIVE_RATIO = 0.5;

interface TraceFacts {
  byId: Map<string, TraceSpan>;
  childrenOf: Map<string, TraceSpan[]>;
}

function factsOf(trace: TraceSpan[]): TraceFacts {
  const byId = new Map(trace.map((span) => [span.spanId, span]));
  const childrenOf = new Map<string, TraceSpan[]>();
  for (const span of trace) {
    if (!span.parentSpanId) continue;
    childrenOf.set(span.parentSpanId, [...(childrenOf.get(span.parentSpanId) ?? []), span]);
  }
  return { byId, childrenOf };
}

function hasDanglingParent(trace: TraceSpan[], facts: TraceFacts): boolean {
  return trace.some((span) => span.isError && span.parentSpanId !== undefined && !facts.byId.has(span.parentSpanId));
}

function isOrigin(span: TraceSpan, facts: TraceFacts): boolean {
  return Boolean(span.isError) && !(facts.childrenOf.get(span.spanId) ?? []).some((child) => child.isError);
}

function erroringAncestorServices(origin: TraceSpan, facts: TraceFacts): string[] {
  const services: string[] = [];
  let parent = origin.parentSpanId ? facts.byId.get(origin.parentSpanId) : undefined;
  while (parent?.isError) {
    services.push(parent.serviceName);
    parent = parent.parentSpanId ? facts.byId.get(parent.parentSpanId) : undefined;
  }
  return services;
}

function callerServices(trace: TraceSpan[], facts: TraceFacts, service: string): string[] {
  return trace
    .filter((span) => span.serviceName === service && span.parentSpanId)
    .flatMap((span) => {
      const parent = facts.byId.get(span.parentSpanId!);
      return parent && parent.serviceName !== service ? [parent.serviceName] : [];
    });
}

export function analyzeErrorPropagation(
  service: string,
  traces: TraceSpan[][],
): { score: number; evidence: Propagation } | undefined {
  const errorTraces = traces.filter((trace) => trace.some((span) => span.isError));
  const empty: Propagation = { originTraces: 0, inconclusiveTraces: 0, propagatedTo: [], absorbedCount: 0, examples: [] };
  if (errorTraces.length === 0) return { score: 0, evidence: empty };

  let inconclusive = 0;
  let originTraces = 0;
  let absorbedCount = 0;
  const propagatedTo = new Set<string>();
  const callers = new Set<string>();
  const examples: Propagation["examples"] = [];

  for (const trace of errorTraces) {
    const facts = factsOf(trace);
    if (hasDanglingParent(trace, facts)) {
      inconclusive++;
      continue;
    }
    trace.forEach((span) => {
      if (span.serviceName === service) callerServices(trace, facts, service).forEach((caller) => callers.add(caller));
    });
    const origins = trace.filter((span) => span.serviceName === service && isOrigin(span, facts));
    if (origins.length === 0) continue;
    originTraces++;
    for (const origin of origins) {
      erroringAncestorServices(origin, facts).filter((name) => name !== service).forEach((name) => propagatedTo.add(name));
      const parent = origin.parentSpanId ? facts.byId.get(origin.parentSpanId) : undefined;
      if (parent && !parent.isError) absorbedCount++;
    }
    if (examples!.length < MAX_PROPAGATION_EXAMPLES) examples!.push({ traceId: origins[0]!.traceId, spanId: origins[0]!.spanId });
  }

  if (inconclusive / errorTraces.length > MAX_INCONCLUSIVE_RATIO) return undefined;

  const conclusive = errorTraces.length - inconclusive;
  const originShare = conclusive === 0 ? 0 : originTraces / conclusive;
  const reachRatio = callers.size === 0 ? 0 : Math.min(1, propagatedTo.size / callers.size);
  const score = originTraces === 0 ? 0 : Math.min(1, originShare * (ORIGIN_BASE_SHARE + REACH_SHARE * reachRatio));

  return {
    score,
    evidence: { originTraces, inconclusiveTraces: inconclusive, propagatedTo: [...propagatedTo].sort(), absorbedCount, examples },
  };
}
