export interface HostBucket {
  bucket: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  network_in_bytes: number;
  network_out_bytes: number;
}

export interface HostPoint {
  time: number;
  cpu: number;
  memory: number;
  disk: number;
  receive: number;
  transmit: number;
}

const BUCKET_SECONDS = 60;
const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const index = Math.min(UNITS.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / 1024 ** index;
  return `${scaled >= 100 || index === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${UNITS[index]}`;
}

export function formatRate(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function hostPoints(buckets: HostBucket[]): HostPoint[] {
  return buckets.flatMap((bucket) => {
    const time = new Date(bucket.bucket).getTime();
    if (!Number.isFinite(time)) return [];
    return [
      {
        time,
        cpu: bucket.cpu_percent,
        memory: bucket.memory_percent,
        disk: bucket.disk_percent,
        receive: bucket.network_in_bytes / BUCKET_SECONDS,
        transmit: bucket.network_out_bytes / BUCKET_SECONDS,
      },
    ];
  });
}

export function networkTotals(buckets: HostBucket[]): { received: number; transmitted: number } {
  return buckets.reduce(
    (sum, bucket) => ({
      received: sum.received + bucket.network_in_bytes,
      transmitted: sum.transmitted + bucket.network_out_bytes,
    }),
    { received: 0, transmitted: 0 },
  );
}

export function averagePercent(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function timeLabel(time: number, spanMs: number): string {
  const date = new Date(time);
  const clock = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (spanMs <= 36 * 3_600_000) return clock;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${clock}`;
}
