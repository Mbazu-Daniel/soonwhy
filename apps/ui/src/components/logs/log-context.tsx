import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import type { LogContextResponse, LogContextScope, LogEntry } from '~/lib/log-types';
import { LEVEL_TREATMENT } from '~/components/logs/log-styles';
import { Badge } from '~/components/ui/badge';

interface Props {
  projectId: string | null | undefined;
  log: LogEntry;
  scopes: LogContextScope[];
}

function Line({ entry, anchor }: { entry: LogEntry; anchor?: boolean }) {
  return (
    <li className={`flex items-baseline gap-2 px-3 py-1 font-mono text-[11px] ${anchor ? 'bg-[#1d2610] text-[#ACFC15]' : ''}`}>
      <time className="shrink-0 text-[#989898]" title={entry.timestamp}>{new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })}.{String(new Date(entry.timestamp).getMilliseconds()).padStart(3, '0')}</time>
      <Badge variant="outline" className={`h-4 shrink-0 px-1 text-[9px] uppercase ${LEVEL_TREATMENT[entry.level] ?? LEVEL_TREATMENT.debug}`}>{entry.level}</Badge>
      <span className="break-all">{entry.message}</span>
    </li>
  );
}

export function LogContext({ projectId, log, scopes }: Props) {
  const [active, setActive] = useState(scopes[0]);
  const context = useQuery({
    queryKey: ['log-context', projectId, log.id, active?.field, active?.value],
    queryFn: () => {
      const params = new URLSearchParams({ id: log.id, timestamp: log.timestamp, field: active!.field, value: active!.value, lines: '10' });
      return api.get<LogContextResponse>(`/projects/${projectId}/logs/context?${params.toString()}`);
    },
    enabled: !!projectId && !!active,
    retry: false,
  });

  if (!active) return null;
  return (
    <div className="rounded border border-[#242426] bg-[#0B0B0C]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#242426] px-3 py-2 text-xs">
        <span className="text-[#989898]">Surrounding lines by</span>
        {scopes.map((scope) => (
          <button key={`${scope.field}=${scope.value}`} type="button" onClick={() => setActive(scope)} aria-pressed={scope === active} title={`${scope.field} = ${scope.value}`} className={`rounded border px-2 py-0.5 ${scope === active ? 'border-[#ACFC15] text-[#ACFC15]' : 'border-[#242426] hover:bg-[#151517]'}`}>{scope.label}</button>
        ))}
      </div>
      {context.isLoading && <Skeleton className="m-3 h-24" />}
      {context.isError && <p className="p-3 text-xs text-[#F28B82]">Could not load the surrounding lines.</p>}
      {context.data && (
        <ul className="max-h-72 overflow-auto py-1">
          {context.data.before.map((entry) => <Line key={entry.id} entry={entry} />)}
          <Line entry={log} anchor />
          {context.data.after.map((entry) => <Line key={entry.id} entry={entry} />)}
          {context.data.before.length + context.data.after.length === 0 && <li className="px-3 py-2 text-xs text-[#6E6E70]">No other lines for this {active.label} within a day of this log.</li>}
        </ul>
      )}
    </div>
  );
}
