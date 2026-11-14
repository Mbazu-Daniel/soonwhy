import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Skeleton } from '~/components/ui/skeleton';
import { useLogFields, useLogFieldValues, type LogSearchParams } from '~/lib/use-log-search';

interface FieldPanelProps {
  search: LogSearchParams;
  onFilter: (field: string, value: string, negate: boolean) => void;
}

function FieldValues({ search, field, onFilter }: FieldPanelProps & { field: string }) {
  const { data, isLoading } = useLogFieldValues(search, field);
  if (isLoading) return <Skeleton className="m-2 h-12" />;
  if (!data?.data.length) return <p className="px-3 py-2 text-[11px] text-[#6E6E70]">No values</p>;
  const total = data.data.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <ul className="space-y-0.5 pb-2">
      {data.data.map((item) => (
        <li key={item.value} className="group flex items-center gap-1 px-3 text-[11px]">
          <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-[#ACFC15]" title={`Include ${item.value}`} onClick={() => onFilter(field, item.value, false)}>{item.value}</button>
          <span className="text-[#6E6E70]">{Math.round((item.count / total) * 100)}%</span>
          <button type="button" aria-label={`Exclude ${item.value}`} className="hidden px-1 text-[#8A1C13] group-hover:inline" onClick={() => onFilter(field, item.value, true)}>−</button>
        </li>
      ))}
    </ul>
  );
}

export function LogFieldPanel({ search, onFilter }: FieldPanelProps) {
  const { data, isLoading } = useLogFields(search);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <aside className="rounded-lg border border-[#242426] bg-[#0B0B0C]">
      <p className="border-b border-[#242426] px-3 py-2 text-xs font-medium text-[#989898]">Fields</p>
      {isLoading ? <Skeleton className="m-3 h-32" /> : (
        <ul className="max-h-[560px] overflow-auto py-1">
          {(data?.data ?? []).map((field) => (
            <li key={field.name}>
              <button type="button" onClick={() => setOpen(open === field.name ? null : field.name)} className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs hover:bg-[#151517]">
                {open === field.name ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="truncate font-mono">{field.name.replace(/^attributes\./, '')}</span>
                {field.kind === 'attribute' && <span className="ml-auto text-[10px] text-[#6E6E70]">{field.count}</span>}
              </button>
              {open === field.name && <FieldValues search={search} field={field.name} onFilter={onFilter} />}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
