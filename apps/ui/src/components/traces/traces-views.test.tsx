import { describe, expect, it } from 'vitest';
import { TraceCharts } from '~/components/traces/trace-charts';
import { TraceWaterfall } from '~/components/trace/trace-waterfall';
import { buildTraceLayout } from '~/components/trace/trace.layout';
import type { TraceSpan } from '~/components/trace/trace.types';
import type { TraceStatBucket } from '~/lib/trace-search';
import { renderHtml } from '~/test-utils/render-html';

const buckets: TraceStatBucket[] = [
  { timestamp: '2026-11-18T10:00:00Z', requests: 10, errors: 1, avgMs: 40, p95Ms: 120 },
  { timestamp: '2026-11-18T10:05:00Z', requests: 20, errors: 0, avgMs: 35, p95Ms: 90 },
];

function span(partial: Partial<TraceSpan> & Pick<TraceSpan, 'spanId' | 'name'>): TraceSpan {
  return { duration: 100, timestamp: '2026-11-18T10:00:00.000Z', service: 'api', ...partial };
}

describe('TraceCharts', () => {
  it('renders nothing without data', () => {
    expect(renderHtml(<TraceCharts buckets={[]} />)).toBe('');
  });

  it('renders the three charts with their latest value', () => {
    const html = renderHtml(<TraceCharts buckets={buckets} />);
    expect(html).toContain('Requests, latest 20');
    expect(html).toContain('Traces with errors, latest 0');
    expect(html).toContain('P95 latency, latest');
    expect(html).toContain('peak 20');
  });

  it('draws one bar per bucket in each chart', () => {
    const html = renderHtml(<TraceCharts buckets={buckets} />);
    expect(html.match(/rounded-t/g)).toHaveLength(buckets.length * 3);
  });
});

describe('TraceWaterfall', () => {
  const spans = [
    span({ spanId: 'a', name: 'GET /orders', duration: 300 }),
    span({ spanId: 'b', parentSpanId: 'a', name: 'SELECT orders', service: 'db', duration: 80, timestamp: '2026-11-18T10:00:00.050Z' }),
    span({ spanId: 'c', parentSpanId: 'a', name: 'POST payments', service: 'payments', status: 'error', duration: 120, timestamp: '2026-11-18T10:00:00.150Z' }),
  ];

  it('lists every span with its service', () => {
    const html = renderHtml(<TraceWaterfall layout={buildTraceLayout(spans)} />);
    for (const text of ['GET /orders', 'SELECT orders', 'POST payments', 'payments', 'db']) {
      expect(html).toContain(text);
    }
  });

  it('marks only the failing span with the error icon', () => {
    const html = renderHtml(<TraceWaterfall layout={buildTraceLayout(spans)} />);
    expect(html.match(/text-red-600/g)).toHaveLength(1);
  });

  it('indents children under their parent', () => {
    const html = renderHtml(<TraceWaterfall layout={buildTraceLayout(spans)} />);
    expect(html).toContain('padding-left:14px');
  });

  it('shows log counts when given', () => {
    const html = renderHtml(<TraceWaterfall layout={buildTraceLayout(spans)} logCounts={{ b: 3 }} />);
    expect(html).toContain('3 logs');
  });

  it('highlights the selected span', () => {
    const html = renderHtml(<TraceWaterfall layout={buildTraceLayout(spans)} selectedSpanId="b" />);
    expect(html.match(/bg-muted /g)?.length ?? 0).toBeGreaterThan(0);
  });

  it('renders an empty trace without crashing', () => {
    const html = renderHtml(<TraceWaterfall layout={buildTraceLayout([])} />);
    expect(html).toContain('Operation');
  });
});
