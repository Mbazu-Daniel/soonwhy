import type {
  Span,
  Trace,
  CriticalPathAnalysis,
  CriticalPathSpan,
  RepeatedSpan,
  DependencyBottleneck,
  ResourceCorrelation,
} from "./trace-intelligence.types";
import { createTelemetryIdentity } from "@soonwhy/shared";

export function analyzeCriticalPath(trace: Trace): CriticalPathAnalysis {
  if (trace.spans.length === 0) {
    throw new Error("Cannot analyze empty trace");
  }

  const spanMap = new Map<string, Span>();
  const childrenMap = new Map<string, Span[]>();

  for (const span of trace.spans) {
    spanMap.set(span.spanId, span);
    if (span.parentSpanId) {
      const children = childrenMap.get(span.parentSpanId) || [];
      children.push(span);
      childrenMap.set(span.parentSpanId, children);
    }
  }

  const rootSpan = spanMap.get(trace.rootSpanId) || trace.spans[0];
  if (!rootSpan) {
    throw new Error("Root span not found");
  }

  const criticalPath = calculateCriticalPath(rootSpan, childrenMap, spanMap);
  const dominantSpan = findDominantSpan(trace.spans);
  const slowChildSpans = findSlowChildSpans(trace.spans, childrenMap);
  const repeatedSpans = findRepeatedSpans(trace.spans);
  const dependencyBottlenecks = findDependencyBottlenecks(trace.spans);
  const errorLocation = findErrorLocation(trace.spans);
  const resourceCorrelation = buildResourceCorrelation(trace);

  return {
    traceId: trace.traceId,
    totalDurationMs: trace.durationMs,
    criticalPath,
    dominantSpan: dominantSpan.span,
    dominantSpanContribution: dominantSpan.contribution,
    slowChildSpans,
    repeatedSpans,
    dependencyBottlenecks,
    errorLocation,
    resourceCorrelation,
  };
}

function calculateCriticalPath(
  span: Span,
  childrenMap: Map<string, Span[]>,
  spanMap: Map<string, Span>,
  depth: number = 0,
): CriticalPathSpan[] {
  const children = childrenMap.get(span.spanId) || [];

  if (children.length === 0) {
    return [
      {
        span,
        contributionPercent: 100,
        isBottleneck: true,
        depth,
      },
    ];
  }

  const childPaths = children.map((child) =>
    calculateCriticalPath(child, childrenMap, spanMap, depth + 1),
  );

  if (childPaths.length === 0) {
    return [
      {
        span,
        contributionPercent: 100,
        isBottleneck: true,
        depth,
      },
    ];
  }

  const criticalChildPath = childPaths.reduce((longest, current) => {
    if (!longest) return current;
    const longestDuration = longest.reduce((sum, s) => sum + s.span.durationMs, 0);
    const currentDuration = current.reduce((sum, s) => sum + s.span.durationMs, 0);
    return currentDuration > longestDuration ? current : longest;
  }, childPaths[0]);

  if (!criticalChildPath) {
    return [
      {
        span,
        contributionPercent: 100,
        isBottleneck: true,
        depth,
      },
    ];
  }

  const childDuration = criticalChildPath.reduce((sum, s) => sum + s.span.durationMs, 0);
  const selfDuration = span.durationMs - childDuration;
  const contributionPercent = (selfDuration / span.durationMs) * 100;

  return [
    {
      span,
      contributionPercent,
      isBottleneck: contributionPercent > 20,
      depth,
    },
    ...criticalChildPath,
  ];
}

function findDominantSpan(spans: Span[]): { span: Span; contribution: number } {
  if (spans.length === 0) {
    throw new Error("Cannot find dominant span in empty array");
  }

  const sorted = [...spans].sort((a, b) => b.durationMs - a.durationMs);
  const dominant = sorted[0];
  if (!dominant) {
    throw new Error("Dominant span is undefined");
  }

  const contribution = (dominant.durationMs / spans.reduce((sum, s) => sum + s.durationMs, 0)) * 100;
  return { span: dominant, contribution };
}

function findSlowChildSpans(
  spans: Span[],
  childrenMap: Map<string, Span[]>,
  thresholdPercent: number = 30,
): Span[] {
  const slowChildren: Span[] = [];

  for (const parent of spans) {
    const children = childrenMap.get(parent.spanId) || [];
    for (const child of children) {
      const contribution = (child.durationMs / parent.durationMs) * 100;
      if (contribution > thresholdPercent) {
        slowChildren.push(child);
      }
    }
  }

  return slowChildren;
}

function findRepeatedSpans(spans: Span[], minCount: number = 3): RepeatedSpan[] {
  const byOperation = new Map<string, Span[]>();

  for (const span of spans) {
    const key = `${span.serviceName}:${span.operationName}`;
    const existing = byOperation.get(key) || [];
    existing.push(span);
    byOperation.set(key, existing);
  }

  const repeated: RepeatedSpan[] = [];

  for (const [key, operationSpans] of byOperation) {
    if (operationSpans.length >= minCount) {
      const parts = key.split(":");
      const serviceName = parts[0];
      const operationName = parts[1];
      if (!serviceName || !operationName) continue;

      const totalDuration = operationSpans.reduce((sum, s) => sum + s.durationMs, 0);
      const avgDuration = totalDuration / operationSpans.length;
      const totalContribution = (totalDuration / spans.reduce((sum, s) => sum + s.durationMs, 0)) * 100;

      repeated.push({
        operationName,
        serviceName,
        count: operationSpans.length,
        totalDurationMs: totalDuration,
        avgDurationMs: avgDuration,
        totalContribution,
      });
    }
  }

  return repeated.sort((a, b) => b.totalContribution - a.totalContribution);
}

function findDependencyBottlenecks(
  spans: Span[],
  thresholdPercent: number = 15,
): DependencyBottleneck[] {
  const bottlenecks: DependencyBottleneck[] = [];

  for (const span of spans) {
    const depType = inferDependencyType(span);
    if (!depType) continue;

    const rootDuration = spans.reduce((sum, s) => sum + s.durationMs, 0);
    const contribution = (span.durationMs / rootDuration) * 100;

    if (contribution > thresholdPercent) {
      bottlenecks.push({
        serviceName: span.serviceName,
        operationName: span.operationName,
        dependencyType: depType,
        avgLatencyMs: span.durationMs,
        totalLatencyMs: span.durationMs,
        contributionPercent: contribution,
        isCritical: contribution > 30,
      });
    }
  }

  return bottlenecks.sort((a, b) => b.contributionPercent - a.contributionPercent);
}

function inferDependencyType(span: Span): "http" | "grpc" | "db" | "cache" | "queue" | "custom" | null {
  const opLower = span.operationName.toLowerCase();
  const tags = span.tags || {};

  if (tags["db.type"] || tags["db.system"] || opLower.includes("sql") || opLower.includes("query")) {
    return "db";
  }
  if (tags["cache.system"] || opLower.includes("redis") || opLower.includes("memcached")) {
    return "cache";
  }
  if (tags["messaging.system"] || opLower.includes("kafka") || opLower.includes("nats") || opLower.includes("queue")) {
    return "queue";
  }
  if (tags["rpc.system"] === "grpc" || opLower.includes("grpc")) {
    return "grpc";
  }
  if (tags["http.method"] || opLower.startsWith("http") || opLower.startsWith("get") || opLower.startsWith("post")) {
    return "http";
  }

  return "custom";
}

function findErrorLocation(spans: Span[]): Span | null {
  for (const span of spans) {
    if (span.status === "error") {
      return span;
    }
  }
  return null;
}

function buildResourceCorrelation(trace: Trace): ResourceCorrelation {
  return {
    cpu: null,
    memory: null,
    disk: null,
    network: null,
    traceStart: trace.startTime,
    traceEnd: new Date(new Date(trace.startTime).getTime() + trace.durationMs).toISOString(),
  };
}

export function compareTraces(before: Trace, after: Trace): {
  latencyChangePercent: number;
  spanCountChange: number;
  newCriticalPath: boolean;
  regression: boolean;
} {
  const latencyChange = ((after.durationMs - before.durationMs) / before.durationMs) * 100;
  const spanCountChange = after.spans.length - before.spans.length;

  const beforePath = analyzeCriticalPath(before).criticalPath;
  const afterPath = analyzeCriticalPath(after).criticalPath;

  const beforeOps = new Set(beforePath.map((cp) => cp.span.operationName));
  const afterOps = new Set(afterPath.map((cp) => cp.span.operationName));

  const newCriticalPath = ![...afterOps].every((op) => beforeOps.has(op));
  const regression = latencyChange > 20;

  return {
    latencyChangePercent: latencyChange,
    spanCountChange,
    newCriticalPath,
    regression,
  };
}
