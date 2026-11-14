import type { ServiceEdge, ServiceNode, SpanRow, TraceLayout, TraceSpan } from './trace.types';

const SERVICE_COLORS = ['#16931F', '#3B82F6', '#F59E0B', '#A855F7', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

export function isErrorSpan(span: TraceSpan): boolean {
  if (span.status === 'error') return true;
  return Number(span.statusCode ?? 0) >= 2;
}

export function serviceColor(services: string[], service: string): string {
  const index = services.indexOf(service);
  return SERVICE_COLORS[(index < 0 ? 0 : index) % SERVICE_COLORS.length]!;
}

function spanStart(span: TraceSpan): number {
  const value = Date.parse(span.timestamp);
  return Number.isFinite(value) ? value : 0;
}

export function buildTraceLayout(spans: TraceSpan[]): TraceLayout {
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  const children = new Map<string, TraceSpan[]>();
  const roots: TraceSpan[] = [];
  for (const span of spans) {
    const parent = span.parentSpanId;
    if (parent && parent !== span.spanId && byId.has(parent)) {
      const list = children.get(parent) ?? [];
      list.push(span);
      children.set(parent, list);
    } else roots.push(span);
  }
  const byStart = (a: TraceSpan, b: TraceSpan) => spanStart(a) - spanStart(b);
  roots.sort(byStart);

  const startMs = spans.length ? Math.min(...spans.map(spanStart)) : 0;
  const endMs = spans.length ? Math.max(...spans.map((span) => spanStart(span) + (Number(span.duration) || 0))) : 0;
  const totalMs = Math.max(endMs - startMs, 0);

  const rows: SpanRow[] = [];
  const visited = new Set<string>();
  const walk = (span: TraceSpan, depth: number) => {
    if (visited.has(span.spanId)) return;
    visited.add(span.spanId);
    const kids = (children.get(span.spanId) ?? []).sort(byStart);
    rows.push({
      span,
      depth,
      offsetMs: spanStart(span) - startMs,
      durationMs: Number(span.duration) || 0,
      hasChildren: kids.length > 0,
      isError: isErrorSpan(span),
    });
    for (const kid of kids) walk(kid, depth + 1);
  };
  for (const root of roots) walk(root, 0);

  const services = [...new Set(rows.map((row) => row.span.service).filter(Boolean))];
  return { rows, totalMs, startMs, services, errorCount: rows.filter((row) => row.isError).length };
}

export function buildServiceGraph(spans: TraceSpan[]): { nodes: ServiceNode[]; edges: ServiceEdge[] } {
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  const stats = new Map<string, ServiceNode>();
  const edgeCounts = new Map<string, ServiceEdge>();

  for (const span of spans) {
    const service = span.service || 'unknown';
    const node = stats.get(service) ?? { service, spanCount: 0, totalMs: 0, errorCount: 0, layer: 0 };
    node.spanCount += 1;
    node.totalMs += Number(span.duration) || 0;
    if (isErrorSpan(span)) node.errorCount += 1;
    stats.set(service, node);

    const parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
    const parentService = parent?.service || undefined;
    if (parent && parentService && parentService !== service) {
      const key = `${parentService}\u0000${service}`;
      const edge = edgeCounts.get(key) ?? { from: parentService, to: service, count: 0 };
      edge.count += 1;
      edgeCounts.set(key, edge);
    }
  }

  const edges = [...edgeCounts.values()];
  const incoming = new Set(edges.map((edge) => edge.to));
  const queue = [...stats.keys()].filter((service) => !incoming.has(service));
  const layers = new Map<string, number>();
  for (const service of queue) layers.set(service, 0);
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]!;
    for (const edge of edges) {
      if (edge.from !== current || layers.has(edge.to)) continue;
      layers.set(edge.to, (layers.get(current) ?? 0) + 1);
      queue.push(edge.to);
    }
  }
  const nodes = [...stats.values()].map((node) => ({ ...node, layer: layers.get(node.service) ?? 0 }));
  return { nodes, edges };
}

export function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  if (value >= 10) return `${Math.round(value)}ms`;
  return `${Number(value.toFixed(2))}ms`;
}
