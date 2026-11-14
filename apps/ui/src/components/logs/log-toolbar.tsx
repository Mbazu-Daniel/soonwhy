import { Clock3, Search } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { TELEMETRY_RANGES } from '~/components/telemetry/time-range-control';
import { REFRESH_OPTIONS, type LogRange } from '~/lib/log-range';

interface ToolbarProps {
  draft: string;
  onDraft: (value: string) => void;
  onRun: () => void;
  range: LogRange;
  onRange: (value: LogRange) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
  level: string;
  onLevel: (value: string) => void;
  refresh: string;
  onRefresh: (value: string) => void;
}

export function LogToolbar(props: ToolbarProps) {
  return (
    <div className="space-y-2">
      <form
        className="flex flex-wrap items-center gap-2 rounded-lg border border-[#242426] bg-[#0B0B0C] px-2 py-1"
        onSubmit={(event) => { event.preventDefault(); props.onRun(); }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search className="h-4 w-4 flex-shrink-0 text-[#989898]" />
          <Input
            aria-label="Search logs"
            placeholder='timeout   level:error   attributes.http.status_code:>=500   "connection reset"'
            value={props.draft}
            onChange={(event) => props.onDraft(event.target.value)}
            className="h-9 flex-1 border-none bg-transparent px-0 font-mono text-xs placeholder-[#6E6E70] focus:ring-0"
          />
        </div>
        {props.range === 'custom' && (
          <>
            <Input aria-label="Custom start time" type="datetime-local" value={props.customFrom} onChange={(event) => props.onCustomFrom(event.target.value)} className="h-9 w-[180px] border-[#242426] bg-[#151517] px-2 text-xs" />
            <span className="text-xs text-[#6E6E70]">to</span>
            <Input aria-label="Custom end time" type="datetime-local" value={props.customTo} onChange={(event) => props.onCustomTo(event.target.value)} className="h-9 w-[180px] border-[#242426] bg-[#151517] px-2 text-xs" />
          </>
        )}
        <Select value={props.range} onValueChange={(value) => props.onRange(value as LogRange)}>
          <SelectTrigger className="h-9 w-[110px] rounded-md border-[#242426] bg-[#151517] px-2 text-xs text-[#ACFC15]">
            <Clock3 className="mr-1 h-3.5 w-3.5 text-[#989898]" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TELEMETRY_RANGES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            <SelectItem value="custom">Custom</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={props.level} onValueChange={props.onLevel}>
          <SelectTrigger className="h-9 w-[110px] rounded-md border-[#242426] bg-[#151517] px-2 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="fatal">Fatal</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
        <Select value={props.refresh} onValueChange={props.onRefresh}>
          <SelectTrigger aria-label="Auto-refresh" className="h-9 w-[120px] rounded-md border-[#242426] bg-[#151517] px-2 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REFRESH_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" className="h-9 px-3 text-xs">Run</Button>
      </form>
      <p className="px-1 text-[11px] text-[#6E6E70]">
        Words match the message. Use <code>field:value</code>, <code>AND</code>, <code>OR</code>, <code>NOT</code>, <code>"exact phrase"</code>, <code>time*</code> and ranges like <code>attributes.http.status_code:&gt;=500</code>.
      </p>
    </div>
  );
}
