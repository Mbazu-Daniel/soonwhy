import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { EmptyProject } from '~/components/empty-state';
import { QueryErrorState } from '~/components/query-error-state';
import { LogFieldPanel } from '~/components/logs/log-field-panel';
import { LogHistogram } from '~/components/logs/log-histogram';
import { LogRow } from '~/components/logs/log-row';
import { LogToolbar } from '~/components/logs/log-toolbar';
import { useProject } from '~/lib/project-context';
import { buildQuery, chipToken, sameChip } from '~/lib/log-query';
import { logWindow, refreshMs, type LogRange } from '~/lib/log-range';
import type { LogFilterChip } from '~/lib/log-types';
import { useLogHistogram, useLogPages, type LogSearchParams } from '~/lib/use-log-search';

interface LogsSearch { service?: string }

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/logs')({
  component: LogViewer,
  validateSearch: (search: Record<string, unknown>): LogsSearch => ({
    service: typeof search.service === 'string' && search.service ? search.service : undefined,
  }),
});

function LogViewer() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { service: initialService } = Route.useSearch();
  const { projectId } = useProject();
  const [range, setRange] = useState<LogRange>('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [level, setLevel] = useState('all');
  const [refresh, setRefresh] = useState('off');
  const [draft, setDraft] = useState('');
  const [text, setText] = useState('');
  const [chips, setChips] = useState<LogFilterChip[]>(initialService ? [{ field: 'service', value: initialService, negate: false }] : []);
  const [tick, setTick] = useState(0);

  const relative = range !== 'custom' && range !== 'all';
  const search = useMemo<LogSearchParams>(() => {
    const window = logWindow(range, customFrom, customTo);
    return { projectId, ...window, level, service: '', q: buildQuery(text, chips) };
    // tick re-evaluates relative ranges on Run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, range, customFrom, customTo, level, text, chips, tick]);
  const polling = relative ? refreshMs(refresh) : false;

  const pages = useLogPages(search, polling);
  const histogram = useLogHistogram(search, polling);
  const logs = useMemo(() => pages.data?.pages.flatMap((page) => page.data) ?? [], [pages.data]);
  const total = pages.data?.pages[0]?.total ?? 0;

  function addChip(field: string, value: string, negate: boolean) {
    const chip = { field, value, negate };
    setChips((current) => (current.some((item) => sameChip(item, chip)) ? current : [...current, chip]));
  }

  function run() {
    setText(draft);
    setTick((value) => value + 1);
  }

  if (!projectId) return <EmptyProject />;

  const syntaxError = pages.isError && pages.error instanceof Error && /Invalid search query|Query /.test(pages.error.message) ? pages.error.message : null;
  if (pages.isError && !syntaxError && !pages.data) return <QueryErrorState onRetry={() => void pages.refetch()} />;

  return (
    <div className="mx-auto w-full space-y-4">
      <LogToolbar
        draft={draft} onDraft={setDraft} onRun={run}
        range={range} onRange={setRange}
        customFrom={customFrom} customTo={customTo} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo}
        level={level} onLevel={setLevel}
        refresh={relative ? refresh : 'off'} onRefresh={setRefresh}
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span key={chipToken(chip)} className="inline-flex items-center gap-1 rounded-full border border-[#242426] bg-[#151517] px-2.5 py-1 font-mono text-[11px]">
              {chip.negate ? 'NOT ' : ''}{chip.field.replace(/^attributes\./, '')}: {chip.value}
              <button type="button" aria-label={`Remove filter ${chip.field}`} onClick={() => setChips((current) => current.filter((item) => !sameChip(item, chip)))}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setChips([])}>Clear filters</Button>
        </div>
      )}

      {syntaxError && <div role="alert" className="rounded-lg border border-[#F8C7C2] bg-[#FDE8E6]/10 px-4 py-3 text-sm text-[#F28B82]">{syntaxError}</div>}

      <LogHistogram buckets={histogram.data?.timeline?.buckets ?? []} />

      <div className="flex items-center justify-between text-xs text-[#6E6E70]">
        <span>{pages.isLoading ? 'Searching…' : `${total.toLocaleString()} matching ${total === 1 ? 'event' : 'events'}`}{logs.length < total && !pages.isLoading ? ` · showing ${logs.length.toLocaleString()}` : ''}</span>
        {polling ? <span>Refreshing every {refresh}s</span> : <span>Newest first</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <LogFieldPanel search={search} onFilter={addChip} />
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-lg border border-[#242426] bg-[#0B0B0C]">
            <table className="w-full text-left text-sm text-[#F6F6F6]">
              <thead className="sticky top-0 z-10 border-b border-[#242426] bg-[#0B0B0C] text-xs text-[#989898]">
                <tr className="h-10">
                  <th className="w-6 p-3"></th>
                  <th className="p-3 pl-0">TIME</th>
                  <th className="p-3">LEVEL</th>
                  <th className="p-3">SERVICE</th>
                  <th className="p-3">MESSAGE</th>
                  <th className="p-3 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242426]">
                {pages.isLoading ? (
                  <tr><td colSpan={6} className="p-4"><Skeleton className="h-40" /></td></tr>
                ) : logs.length > 0 ? (
                  logs.map((log) => <LogRow key={log.id} log={log} organizationSlug={organizationSlug} projectSlug={projectSlug} onFilter={addChip} />)
                ) : (
                  <tr><td colSpan={6} className="p-8 text-center text-[#6E6E70]">No logs match this query. Try a broader search or remove a filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pages.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>{pages.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
