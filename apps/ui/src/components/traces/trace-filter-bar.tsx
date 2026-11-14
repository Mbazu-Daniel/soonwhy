import { Search, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { TimeRangeControl, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { EMPTY_TRACE_FILTERS, hasTraceFilters, type TraceFilterState } from '~/lib/trace-search';

interface Props {
  filters: TraceFilterState;
  onChange: (filters: TraceFilterState) => void;
  services: string[];
  range: TelemetryRange;
  onRange: (range: TelemetryRange) => void;
}

const ALL = '__all__';

export function TraceFilterBar({ filters, onChange, services, range, onRange }: Props) {
  const set = (patch: Partial<TraceFilterState>) => onChange({ ...filters, ...patch });
  const serviceOptions = filters.service && !services.includes(filters.service) ? [filters.service, ...services] : services;
  return (
    <div className="space-y-2 rounded-lg border border-[#242426] bg-[#0B0B0C] p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 px-1">
          <Search className="h-4 w-4 shrink-0 text-[#989898]" />
          <Input aria-label="Search traces" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Trace ID or operation name" className="h-9 flex-1 border-none bg-transparent px-0 text-sm placeholder-[#6E6E70] focus:ring-0" />
        </div>
        <TimeRangeControl value={range} onChange={onRange} />
      </div>
      {filters.traceIds && (
        <p className="flex items-center gap-2 px-1 text-xs text-[#989898]">
          Showing {filters.traceIds.split(',').length.toLocaleString()} traces from an error group, over the last 30 days.
          <button type="button" className="underline hover:text-[#F6F6F6]" onClick={() => set({ traceIds: '' })}>Show all traces</button>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.service || ALL} onValueChange={(value) => set({ service: value === ALL ? '' : value })}>
          <SelectTrigger aria-label="Service" className="h-9 w-[160px] border-[#242426] bg-[#151517] px-2 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All services</SelectItem>
            {serviceOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input aria-label="Operation" value={filters.operation} onChange={(e) => set({ operation: e.target.value })} placeholder="Operation, exact (GET /users)" className="h-9 w-[220px] border-[#242426] bg-[#151517] px-2 text-xs" />
        <Select value={filters.status} onValueChange={(value) => set({ status: value as TraceFilterState['status'] })}>
          <SelectTrigger aria-label="Status" className="h-9 w-[130px] border-[#242426] bg-[#151517] px-2 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="error">With errors</SelectItem>
            <SelectItem value="ok">No errors</SelectItem>
          </SelectContent>
        </Select>
        <Input aria-label="Minimum duration in milliseconds" inputMode="numeric" value={filters.minDuration} onChange={(e) => set({ minDuration: e.target.value })} placeholder="Min ms" className="h-9 w-[90px] border-[#242426] bg-[#151517] px-2 text-xs" />
        <Input aria-label="Maximum duration in milliseconds" inputMode="numeric" value={filters.maxDuration} onChange={(e) => set({ maxDuration: e.target.value })} placeholder="Max ms" className="h-9 w-[90px] border-[#242426] bg-[#151517] px-2 text-xs" />
        {hasTraceFilters(filters) && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs" onClick={() => onChange(EMPTY_TRACE_FILTERS)}><X className="h-3 w-3" />Clear</Button>
        )}
      </div>
    </div>
  );
}
