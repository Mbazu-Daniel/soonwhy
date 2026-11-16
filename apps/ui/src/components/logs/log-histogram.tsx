import type { HistogramBucket } from '~/lib/log-types';
import { barPercent, bucketSpanMs, formatAxisTick, formatBucketRange, tooltipAlign } from '~/lib/log-histogram-view';

const ALIGN_CLASS = { left: 'left-0', center: 'left-1/2 -translate-x-1/2', right: 'right-0' } as const;

export function LogHistogram({ buckets }: { buckets: HistogramBucket[] }) {
  if (!buckets.length) return null;
  const peak = Math.max(1, ...buckets.map((bucket) => bucket.doc_count));
  const total = buckets.reduce((sum, bucket) => sum + bucket.doc_count, 0);
  const span = bucketSpanMs(buckets);
  const first = buckets[0]!.key;
  const last = buckets[buckets.length - 1]!.key + span;
  return (
    <section className="rounded-lg border border-[#242426] bg-[#0B0B0C] px-3 pb-2 pt-3" aria-label="Events over time">
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="font-medium text-[#989898]">Events over time</span>
        <span className="text-[#6E6E70]">{total.toLocaleString()} events · peak {peak.toLocaleString()} per bar</span>
      </div>
      <div className="flex h-16 items-end gap-px">
        {buckets.map((bucket, index) => (
          <div key={bucket.key} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-[#415312] transition-colors group-hover:bg-[#ACFC15]"
              style={{ height: `${barPercent(bucket.doc_count, peak)}%` }}
            />
            <div
              role="tooltip"
              className={`pointer-events-none absolute bottom-full z-20 mb-1 hidden whitespace-nowrap rounded-md border border-[#242426] bg-[#151517] px-2.5 py-1.5 text-[11px] shadow-lg group-hover:block ${ALIGN_CLASS[tooltipAlign(index, buckets.length)]}`}
            >
              <p className="text-[#989898]">{formatBucketRange(bucket.key, span)}</p>
              <p className="font-medium text-[#F6F6F6]">{bucket.doc_count.toLocaleString()} {bucket.doc_count === 1 ? 'event' : 'events'}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[#6E6E70]">
        <span>{formatAxisTick(first, span)}</span>
        <span>{formatAxisTick(last, span)}</span>
      </div>
    </section>
  );
}
