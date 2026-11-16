import type { TraceStatBucket } from '~/lib/trace-search';
import { formatMs } from '~/lib/format-ms';

interface ChartProps {
  title: string;
  values: number[];
  labels: string[];
  color: string;
  format: (value: number) => string;
}

function MiniChart({ title, values, labels, color, format }: ChartProps) {
  const peak = Math.max(1, ...values);
  const latest = values.length ? values[values.length - 1]! : 0;
  return (
    <div className="rounded-lg border border-[#242426] bg-[#0B0B0C] p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-[#989898]">{title}</p>
        <p className="font-mono text-xs">peak {format(peak === 1 && !values.some(Boolean) ? 0 : peak)}</p>
      </div>
      <div className="mt-2 flex h-16 items-end gap-px" role="img" aria-label={`${title}, latest ${format(latest)}`}>
        {values.map((value, index) => (
          <div key={labels[index]} className="flex h-full flex-1 items-end" title={`${labels[index]}: ${format(value)}`}>
            <div className="w-full rounded-t" style={{ height: `${value ? Math.max(4, (value / peak) * 100) : 0}%`, backgroundColor: color }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TraceCharts({ buckets }: { buckets: TraceStatBucket[] }) {
  if (!buckets.length) return null;
  const labels = buckets.map((bucket) => new Date(bucket.timestamp).toLocaleString());
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <MiniChart title="Requests" values={buckets.map((b) => b.requests)} labels={labels} color="#415312" format={(v) => String(Math.round(v))} />
      <MiniChart title="Traces with errors" values={buckets.map((b) => b.errors)} labels={labels} color="#DC2626" format={(v) => String(Math.round(v))} />
      <MiniChart title="P95 latency" values={buckets.map((b) => b.p95Ms)} labels={labels} color="#D8C68A" format={formatMs} />
    </div>
  );
}
