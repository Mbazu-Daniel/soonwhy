import type { HistogramBucket } from '~/lib/log-types';

export function LogHistogram({ buckets }: { buckets: HistogramBucket[] }) {
  if (!buckets.length) return null;
  const peak = Math.max(1, ...buckets.map((bucket) => bucket.doc_count));
  return (
    <div className="flex h-16 items-end gap-px rounded-lg border border-[#242426] bg-[#0B0B0C] px-2 pt-2" aria-label="Matches over time">
      {buckets.map((bucket) => (
        <div key={bucket.key} className="flex h-full flex-1 items-end" title={`${new Date(bucket.key).toLocaleString()}: ${bucket.doc_count}`}>
          <div className="w-full rounded-t bg-[#415312] hover:bg-[#ACFC15]" style={{ height: `${bucket.doc_count ? Math.max(4, (bucket.doc_count / peak) * 100) : 0}%` }} />
        </div>
      ))}
    </div>
  );
}
