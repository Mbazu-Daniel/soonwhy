import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Skeleton } from '~/components/ui/skeleton';
import { fieldLabel, groupLogFields } from '~/lib/log-field-groups';
import { sameChip } from '~/lib/log-query';
import type { LogFieldName, LogFilterChip } from '~/lib/log-types';
import { useLogFields, useLogFieldValues, type LogSearchParams } from '~/lib/use-log-search';

interface FieldPanelProps {
  search: LogSearchParams;
  chips: LogFilterChip[];
  onFilter: (field: string, value: string, negate: boolean) => void;
}

function FieldValues({ search, chips, field, onFilter }: FieldPanelProps & { field: string }) {
  const { data, isLoading } = useLogFieldValues(search, field);
  if (isLoading) return <Skeleton className="mx-3 mb-2 h-12" />;
  if (!data?.data.length) return <p className="px-3 pb-2 text-[11px] text-[#6E6E70]">No values in this range</p>;
  const total = data.data.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <ul className="space-y-0.5 px-2 pb-2">
      {data.data.map((item) => {
        const included = chips.some((chip) => sameChip(chip, { field, value: item.value, negate: false }));
        const excluded = chips.some((chip) => sameChip(chip, { field, value: item.value, negate: true }));
        return (
          <li key={item.value} className="group relative flex items-center overflow-hidden rounded text-[11px] hover:bg-[#151517]">
            <span aria-hidden className="absolute inset-y-0 left-0 bg-[#ACFC15]/10" style={{ width: `${Math.round((item.count / total) * 100)}%` }} />
            <button
              type="button"
              disabled={included}
              title={included ? `Already filtering ${item.value}` : `Only show ${item.value}`}
              className="relative flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left disabled:cursor-default"
              onClick={() => onFilter(field, item.value, false)}
            >
              <span className={`min-w-0 flex-1 truncate ${included ? 'text-[#ACFC15]' : excluded ? 'text-[#8A1C13] line-through' : ''}`}>{item.value}</span>
              <span className="tabular-nums text-[#6E6E70]">{item.count.toLocaleString()}</span>
            </button>
            <button
              type="button"
              aria-label={`Hide ${item.value}`}
              title={`Hide ${item.value}`}
              className="relative px-2 py-1 text-[#8A1C13] opacity-0 focus:opacity-100 group-hover:opacity-100"
              onClick={() => onFilter(field, item.value, true)}
            >
              −
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-[#6E6E70]">{children}</p>;
}

function QuickField(props: FieldPanelProps & { field: LogFieldName }) {
  return (
    <div>
      <p className="px-3 pt-2 text-xs font-medium">{fieldLabel(props.field.name)}</p>
      <FieldValues {...props} field={props.field.name} />
    </div>
  );
}

function FieldRow(props: FieldPanelProps & { field: LogFieldName; open: boolean; onToggle: () => void }) {
  const { field, open, onToggle } = props;
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs hover:bg-[#151517]">
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="truncate font-mono">{fieldLabel(field.name)}</span>
        {field.kind === 'attribute' && <span className="ml-auto text-[10px] tabular-nums text-[#6E6E70]" title="Events with this field">{field.count}</span>}
      </button>
      {open && <FieldValues {...props} field={field.name} />}
    </li>
  );
}

export function LogFieldPanel({ search, chips, onFilter }: FieldPanelProps) {
  const { data, isLoading } = useLogFields(search);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const groups = groupLogFields(data?.data ?? [], query);
  const empty = !groups.quick.length && !groups.core.length && !groups.attributes.length;
  const toggle = (name: string) => setOpen(open === name ? null : name);
  const row = (field: LogFieldName) => (
    <FieldRow key={field.name} search={search} chips={chips} onFilter={onFilter} field={field} open={open === field.name} onToggle={() => toggle(field.name)} />
  );
  return (
    <aside className="rounded-lg border border-[#242426] bg-[#0B0B0C]">
      <div className="border-b border-[#242426] p-2">
        <label className="relative block">
          <span className="sr-only">Filter fields</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#6E6E70]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter fields"
            className="h-8 w-full rounded-md border border-[#242426] bg-[#151517] pl-7 pr-2 text-xs outline-none placeholder:text-[#6E6E70] focus:border-[#415312]"
          />
        </label>
      </div>
      {isLoading ? <Skeleton className="m-3 h-32" /> : (
        <div className="max-h-[560px] overflow-auto pb-1">
          {groups.quick.length > 0 && (
            <>
              <SectionTitle>Quick filters</SectionTitle>
              {groups.quick.map((field) => <QuickField key={field.name} search={search} chips={chips} onFilter={onFilter} field={field} />)}
            </>
          )}
          {groups.core.length > 0 && (
            <>
              <SectionTitle>Core fields</SectionTitle>
              <ul>{groups.core.map(row)}</ul>
            </>
          )}
          {groups.attributes.length > 0 && (
            <>
              <SectionTitle>Attributes</SectionTitle>
              <ul>{groups.attributes.map(row)}</ul>
            </>
          )}
          {empty && <p className="px-3 py-4 text-xs text-[#6E6E70]">No fields match “{query}”.</p>}
        </div>
      )}
    </aside>
  );
}
