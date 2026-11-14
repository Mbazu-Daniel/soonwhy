import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { EmptyProject } from '~/components/empty-state';
import { QueryErrorState } from '~/components/query-error-state';
import { LogFieldPanel } from '~/components/logs/log-field-panel';
import { LogHistogram } from '~/components/logs/log-histogram';
import { LogRow } from '~/components/logs/log-row';
import { LogToolbar } from '~/components/logs/log-toolbar';
import { LogExportMenu } from '~/components/logs/log-export-menu';
import { LogViewsMenu } from '~/components/logs/log-views-menu';
import { useProject } from '~/lib/project-context';
import { buildQuery, chipToken, sameChip } from '~/lib/log-query';
import { logWindow, refreshMs, type LogRange } from '~/lib/log-range';
import type { LogFilterChip } from '~/lib/log-types';
import { viewFromSearch, type LogsSearch, type LogViewState } from '~/lib/log-view';
import { useSharedView } from '~/lib/use-saved-views';
import { useLogHistogram, useLogPages, type LogSearchParams } from '~/lib/use-log-search';

const searchText = (value: unknown, max = 4000): string | undefined =>
  typeof value === 'string' && value ? value.slice(0, max) : undefined;

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/logs')({
  component: LogViewer,
  validateSearch: (search: Record<string, unknown>): LogsSearch => ({
    service: searchText(search.service, 200),
    traceId: searchText(search.traceId, 200),
    spanId: searchText(search.spanId, 200),
    q: searchText(search.q, 2000),
    level: searchText(search.level, 20),
    range: searchText(search.range, 20),
    from: searchText(search.from, 40),
    to: searchText(search.to, 40),
    f: searchText(search.f),
    view: searchText(search.view, 200),
  }),
});

function LogViewer() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const urlSearch = Route.useSearch();
  const { projectId } = useProject();
  const [initial] = useState(() => viewFromSearch(urlSearch));
  const [range, setRange] = useState<LogRange>(initial.range);
  const [customFrom, setCustomFrom] = useState(initial.customFrom);
  const [customTo, setCustomTo] = useState(initial.customTo);
  const [level, setLevel] = useState(initial.level);
  const [refresh, setRefresh] = useState('off');
  const [draft, setDraft] = useState(initial.q);
  const [text, setText] = useState(initial.q);
  const [chips, setChips] = useState<LogFilterChip[]>(initial.chips);
  const shared = useSharedView(projectId, urlSearch.view);

  function applyView(view: LogViewState) {
    setRange(view.range);
    setCustomFrom(view.customFrom);
    setCustomTo(view.customTo);
    setLevel(view.level);
    setDraft(view.q);
    setText(view.q);
    setChips(view.chips);
  }

  useEffect(() => {
    if (shared.data) applyView(shared.data.view);
  }, [shared.data]);

  const currentView: LogViewState = { q: text, level, range, customFrom, customTo, chips };

  const relative = range !== 'custom' && range !== 'all';
  const search = useMemo<LogSearchParams>(
    () => ({
      projectId,
      rangeKey: relative ? range : `${range}:${customFrom}:${customTo}`,
      getWindow: () => logWindow(range, customFrom, customTo),
      level,
      service: '',
      q: buildQuery(text, chips),
    }),
    [projectId, range, relative, customFrom, customTo, level, text, chips],
  );
  const polling = relative ? refreshMs(refresh) : false;

  const pages = useLogPages(search, polling);
  const histogram = useLogHistogram(search, polling);
  const logs = useMemo(() => {
    const seen = new Set<string>();
    return (pages.data?.pages.flatMap((page) => page.data) ?? []).filter((log) => !seen.has(log.id) && !!seen.add(log.id));
  }, [pages.data]);
  const total = pages.data?.pages[0]?.total ?? 0;

  function addChip(field: string, value: string, negate: boolean) {
    const chip = { field, value, negate };
    setChips((current) => (current.some((item) => sameChip(item, chip)) ? current : [...current, chip]));
  }

  function run() {
    setText(draft);
    if (draft === text) void pages.refetch();
  }

  if (!projectId) return <EmptyProject />;

  const syntaxError = pages.isError && pages.error instanceof Error && /Invalid search query|Query /.test(pages.error.message) ? pages.error.message : null;
  if (pages.isError && !syntaxError && !pages.data) return <QueryErrorState onRetry={() => void pages.refetch()} />;

  return (
    <div className="mx-auto w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#6E6E70]">{shared.data ? `Opened view: ${shared.data.name}` : shared.isError ? 'That saved view was not found.' : ''}</p>
        <div className="flex items-center gap-2">
          <LogExportMenu search={search} total={total} />
          <LogViewsMenu projectId={projectId} view={currentView} onApply={applyView} />
        </div>
      </div>

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
                  logs.map((log) => <LogRow key={log.id} log={log} projectId={projectId} organizationSlug={organizationSlug} projectSlug={projectSlug} onFilter={addChip} />)
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
