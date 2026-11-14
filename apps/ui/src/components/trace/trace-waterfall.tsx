import { AlertCircle } from 'lucide-react';
import { formatMs, serviceColor } from './trace.layout';
import type { TraceLayout } from './trace.types';

const TICKS = [0, 0.25, 0.5, 0.75, 1];

interface TraceWaterfallProps {
  layout: TraceLayout;
  selectedSpanId?: string;
  onSelect?: (spanId: string) => void;
  compact?: boolean;
}

export function TraceWaterfall({ layout, selectedSpanId, onSelect, compact }: TraceWaterfallProps) {
  const { rows, totalMs, services } = layout;
  const labelWidth = compact ? 'minmax(130px,200px)' : 'minmax(180px,300px)';

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="grid gap-3 border-b bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
          <span className="uppercase tracking-wide">Operation</span>
          <div className="relative h-4">
            {TICKS.map((tick) => (
              <span key={tick} className="absolute font-mono" style={{ left: `${tick * 100}%`, transform: tick === 1 ? 'translateX(-100%)' : tick === 0 ? 'none' : 'translateX(-50%)' }}>
                {formatMs(totalMs * tick)}
              </span>
            ))}
          </div>
        </div>
        {rows.map((row) => {
          const left = totalMs ? (row.offsetMs / totalMs) * 100 : 0;
          const width = totalMs ? Math.max((row.durationMs / totalMs) * 100, 0.6) : 100;
          const color = row.isError ? '#DC2626' : serviceColor(services, row.span.service);
          const selected = selectedSpanId === row.span.spanId;
          const labelInside = width > 22;
          return (
            <button
              key={row.span.spanId}
              type="button"
              onClick={() => onSelect?.(row.span.spanId)}
              className={`grid w-full gap-3 border-b px-3 py-2 text-left transition-colors hover:bg-muted ${selected ? 'bg-muted' : ''}`}
              style={{ gridTemplateColumns: `${labelWidth} 1fr` }}
            >
              <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: row.depth * 14 }}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-xs font-medium">
                    {row.isError && <AlertCircle className="h-3 w-3 shrink-0 text-red-600" />}
                    <span className="truncate">{row.span.name}</span>
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{row.span.service}</p>
                </div>
              </div>
              <div className="relative h-7">
                {TICKS.slice(1, -1).map((tick) => <span key={tick} className="absolute inset-y-0 w-px bg-border/60" style={{ left: `${tick * 100}%` }} />)}
                <span
                  className="absolute top-1/2 flex h-4 -translate-y-1/2 items-center overflow-hidden rounded px-1 text-[10px] font-medium text-white"
                  style={{ left: `${Math.min(left, 100 - width)}%`, width: `${width}%`, backgroundColor: color, minWidth: 3 }}
                >
                  {labelInside && formatMs(row.durationMs)}
                </span>
                {!labelInside && (
                  <span className="absolute top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground" style={left > 60 ? { right: `${100 - left + 0.5}%` } : { left: `${left + width + 0.5}%` }}>
                    {formatMs(row.durationMs)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
