import type { HistogramBucket } from '~/lib/log-types';
import { DAY_MS, MIN_BAR_PERCENT, type TooltipAlign } from './log-histogram-view.constants';

export function bucketSpanMs(buckets: HistogramBucket[]): number {
  let span = 0;
  for (let index = 1; index < buckets.length; index += 1) {
    const gap = buckets[index]!.key - buckets[index - 1]!.key;
    if (gap > 0 && (span === 0 || gap < span)) span = gap;
  }
  return span;
}

export function barPercent(count: number, peak: number): number {
  if (count <= 0 || peak <= 0) return 0;
  return Math.max(MIN_BAR_PERCENT, (count / peak) * 100);
}

export function tooltipAlign(index: number, total: number): TooltipAlign {
  if (total < 3) return 'center';
  if (index < total * 0.2) return 'left';
  if (index > total * 0.8) return 'right';
  return 'center';
}

const clock = (value: number) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const day = (value: number) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });

export function formatBucketRange(start: number, spanMs: number): string {
  if (spanMs >= DAY_MS) return day(start);
  if (spanMs <= 0) return `${day(start)}, ${clock(start)}`;
  return `${day(start)}, ${clock(start)} – ${clock(start + spanMs)}`;
}

export function formatAxisTick(value: number, spanMs: number): string {
  return spanMs >= DAY_MS ? day(value) : `${day(value)} ${clock(value)}`;
}
