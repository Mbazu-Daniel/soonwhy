import { cn } from '~/lib/utils';

export const TELEMETRY_RANGES = [
  { value: '1h', label: '1h', ms: 60 * 60 * 1000 },
  { value: '6h', label: '6h', ms: 6 * 60 * 60 * 1000 },
  { value: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type TelemetryRange = (typeof TELEMETRY_RANGES)[number]['value'];

export function telemetryRangeParams(range: TelemetryRange) {
  const end = new Date();
  const definition = TELEMETRY_RANGES.find((item) => item.value === range) ?? TELEMETRY_RANGES[2];
  const start = new Date(end.getTime() - definition.ms);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function TimeRangeControl({ value, onChange }: { value: TelemetryRange; onChange: (value: TelemetryRange) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-0.5" aria-label="Telemetry time range">
      {TELEMETRY_RANGES.map((range) => (
        <button key={range.value} type="button" onClick={() => onChange(range.value)}
          className={cn('rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            value === range.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          aria-pressed={value === range.value}>{range.label}</button>
      ))}
    </div>
  );
}
