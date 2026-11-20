import {
  DOMINANT_CRITICAL_SHARE, DOMINANT_MIN_MS, DOMINANT_SELF_SHARE, REPEATED_MIN_CALLS, REPEATED_MIN_TOTAL_MS,
  SEQUENTIAL_GAP_MS, SEQUENTIAL_MIN_CALLS, SEQUENTIAL_MIN_TOTAL_MS, SERVER_ERROR_STATUS, SLOW_DEPENDENCY_MIN_MS,
  SLOW_DEPENDENCY_SHARE, SPAN_ERROR_STATUS,
} from "./trace-insights.constants";
import type { CriticalPathStep, InsightSpan, SpanNode, TraceInsight, TraceInsights } from "./trace-insights.types";

const ms = (value: number) => `${Math.round(value)} ms`;

function build(spans: InsightSpan[]): SpanNode[] {
  const nodes = new Map<string, SpanNode>();
  for (const span of spans) {
    const start = new Date(span.timestamp).getTime();
    nodes.set(span.spanId, { ...span, start, end: start + span.duration, children: [], selfMs: span.duration });
  }
  const roots: SpanNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentSpanId ? nodes.get(node.parentSpanId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  for (const node of nodes.values()) {
    node.children.sort((a, b) => a.start - b.start);
    node.selfMs = Math.max(0, node.duration - covered(node));
  }
  return roots;
}

function covered(node: SpanNode): number {
  let total = 0;
  let cursor = node.start;
  for (const child of node.children) {
    const from = Math.max(child.start, cursor, node.start);
    const to = Math.min(child.end, node.end);
    if (to > from) {
      total += to - from;
      cursor = to;
    }
  }
  return total;
}

function flatten(node: SpanNode, out: SpanNode[] = []): SpanNode[] {
  out.push(node);
  for (const child of node.children) flatten(child, out);
  return out;
}

function criticalPath(root: SpanNode): CriticalPathStep[] {
  const steps: CriticalPathStep[] = [];
  let current: SpanNode | undefined = root;
  while (current) {
    steps.push({ spanId: current.spanId, name: current.name, service: current.service, durationMs: current.duration, selfMs: current.selfMs });
    current = current.children.reduce<SpanNode | undefined>((latest, child) => (!latest || child.end > latest.end ? child : latest), undefined);
  }
  return steps;
}

function isError(node: SpanNode): boolean {
  const status = Number(node.statusCode);
  const http = Number(node.attributes?.["http.response.status_code"] ?? node.attributes?.["http.status_code"]);
  return status === SPAN_ERROR_STATUS || http >= SERVER_ERROR_STATUS;
}

function dominant(nodes: SpanNode[], total: number): TraceInsight[] {
  const top = nodes.reduce((best, node) => (node.selfMs > best.selfMs ? node : best), nodes[0]!);
  if (top.selfMs < DOMINANT_MIN_MS || top.selfMs / total < DOMINANT_SELF_SHARE) return [];
  const share = Math.round((top.selfMs / total) * 100);
  return [{
    kind: "dominant_span",
    severity: top.selfMs / total >= DOMINANT_CRITICAL_SHARE ? "critical" : "warning",
    title: `${top.name} holds ${share}% of this request`,
    detail: `${top.service} spent ${ms(top.selfMs)} inside ${top.name} itself, not waiting on other calls. Profile this step first.`,
    spanIds: [top.spanId],
    impactMs: top.selfMs,
  }];
}

function slowDependencies(nodes: SpanNode[], total: number): TraceInsight[] {
  return nodes
    .filter((node) => node.children.length === 0 && node.parentSpanId && node.duration >= SLOW_DEPENDENCY_MIN_MS && node.duration / total >= SLOW_DEPENDENCY_SHARE)
    .map((node) => ({
      kind: "slow_dependency" as const,
      severity: "warning" as const,
      title: `Waiting on ${node.name}`,
      detail: `${node.name} took ${ms(node.duration)}, ${Math.round((node.duration / total) * 100)}% of the request. Check that call, add a timeout or cache it.`,
      spanIds: [node.spanId],
      impactMs: node.duration,
    }));
}

function sequentialCalls(nodes: SpanNode[]): TraceInsight[] {
  const found: TraceInsight[] = [];
  for (const parent of nodes) {
    const leaves = parent.children.filter((child) => child.children.length === 0);
    let run: SpanNode[] = [];
    const flush = () => {
      const total = run.reduce((sum, call) => sum + call.duration, 0);
      if (run.length >= SEQUENTIAL_MIN_CALLS && total >= SEQUENTIAL_MIN_TOTAL_MS) {
        const saved = total - Math.max(...run.map((call) => call.duration));
        found.push({
          kind: "sequential_calls",
          severity: saved >= total / 2 ? "warning" : "info",
          title: `${run.length} calls in ${parent.name} run one after another`,
          detail: `They took ${ms(total)} in a row. If they do not depend on each other, run them together to save up to ${ms(saved)}.`,
          spanIds: run.map((call) => call.spanId),
          impactMs: saved,
        });
      }
      run = [];
    };
    for (const call of leaves) {
      const last = run[run.length - 1];
      if (last && call.start - last.end > SEQUENTIAL_GAP_MS) flush();
      if (last && call.start < last.end) flush();
      run.push(call);
    }
    flush();
  }
  return found;
}

function repeatedCalls(nodes: SpanNode[]): TraceInsight[] {
  const found: TraceInsight[] = [];
  for (const parent of nodes) {
    const groups = new Map<string, SpanNode[]>();
    for (const child of parent.children) {
      if (child.children.length) continue;
      const key = `${child.service}|${child.name}`;
      groups.set(key, [...(groups.get(key) ?? []), child]);
    }
    for (const calls of groups.values()) {
      const total = calls.reduce((sum, call) => sum + call.duration, 0);
      if (calls.length < REPEATED_MIN_CALLS || total < REPEATED_MIN_TOTAL_MS) continue;
      found.push({
        kind: "repeated_calls",
        severity: "warning",
        title: `${calls[0]!.name} is called ${calls.length} times in one request`,
        detail: `${ms(total)} in total. Batch the calls, cache the result, or fetch once and reuse it.`,
        spanIds: calls.map((call) => call.spanId),
        impactMs: total,
      });
    }
  }
  return found;
}

function errorOrigin(nodes: SpanNode[]): TraceInsight[] {
  const origin = nodes
    .filter((node) => isError(node) && !node.children.some(isError))
    .sort((a, b) => a.start - b.start)[0];
  if (!origin) return [];
  const reason = origin.exceptionMessage || origin.statusMessage;
  return [{
    kind: "error_origin",
    severity: "critical",
    title: `The failure starts in ${origin.name}`,
    detail: `${origin.service} reported the error${reason ? `: ${reason}` : ""}. Spans above it failed because of it.`,
    spanIds: [origin.spanId],
    impactMs: origin.duration,
  }];
}

const ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function analyzeTraceInsights(spans: InsightSpan[]): TraceInsights {
  const roots = build(spans);
  if (roots.length === 0) return { durationMs: 0, criticalPath: [], findings: [] };
  const root = roots.reduce((longest, node) => (node.duration > longest.duration ? node : longest), roots[0]!);
  const nodes = flatten(root);
  const total = Math.max(root.duration, 1);
  const findings = [
    ...errorOrigin(nodes),
    ...dominant(nodes, total),
    ...slowDependencies(nodes, total),
    ...sequentialCalls(nodes),
    ...repeatedCalls(nodes),
  ].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.impactMs - a.impactMs);
  return { durationMs: root.duration, criticalPath: criticalPath(root), findings };
}
