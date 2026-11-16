import { describe, expect, it } from 'vitest';
import { barPercent, bucketSpanMs, tooltipAlign } from './log-histogram-view';

describe('log histogram view', () => {
  it('uses the smallest gap between buckets as the span', () => {
    expect(bucketSpanMs([{ key: 0, doc_count: 1 }, { key: 300000, doc_count: 1 }, { key: 900000, doc_count: 1 }])).toBe(300000);
    expect(bucketSpanMs([{ key: 0, doc_count: 1 }])).toBe(0);
  });

  it('keeps empty buckets flat and small buckets visible', () => {
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(1, 1000)).toBe(4);
    expect(barPercent(10, 10)).toBe(100);
  });

  it('keeps tooltips inside the chart at both ends', () => {
    expect(tooltipAlign(0, 20)).toBe('left');
    expect(tooltipAlign(19, 20)).toBe('right');
    expect(tooltipAlign(10, 20)).toBe('center');
    expect(tooltipAlign(0, 2)).toBe('center');
  });
});
