import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock, FileSearch, Search } from 'lucide-react';
import { ConnectServiceButton } from '~/components/connect-service-button';
import { EmptyProject } from '~/components/empty-state';
import { FindingDrawer } from '~/components/findings/finding-drawer';
import { QueryErrorState } from '~/components/query-error-state';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { matchesFilters, ruleLabel } from '~/lib/findings';
import type { DetectionFinding, FindingSeverity } from '~/lib/findings.types';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/intelligence/findings')({ component: DetectionOverview });

const FIELD = 'rounded-md border border-border bg-background px-3 py-2 text-sm';

function DetectionOverview() {
  const { organizationSlug } = Route.useParams();
  const { projectId } = useProject();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ query: '', severity: '', type: '' });
  const { data: findings, isLoading, isError, refetch } = useQuery({
    queryKey: ['detections', projectId],
    queryFn: () => api.get<DetectionFinding[]>(`/projects/${projectId}/detections`),
    enabled: !!projectId,
  });

  const types = useMemo(() => [...new Set((findings ?? []).map((item) => item.type))].sort(), [findings]);
  const visible = useMemo(() => (findings ?? []).filter((item) => matchesFilters(item, filters)), [findings, filters]);
  const selected = findings?.find((item) => item.id === selectedId) ?? null;
  const set = (key: keyof typeof filters, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));

  if (!projectId) return <EmptyProject />;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Findings</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={filters.query} onChange={(event) => set('query', event.target.value)} placeholder="Search findings…" aria-label="Search findings" className="pl-9" />
        </div>
        <select aria-label="Severity" value={filters.severity} onChange={(event) => set('severity', event.target.value)} className={FIELD}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
        </select>
        <select aria-label="Rule" value={filters.type} onChange={(event) => set('type', event.target.value)} className={FIELD}>
          <option value="">All rules</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {ruleLabel(type)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-[480px]" />
      ) : !findings?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileSearch className="mx-auto h-8 w-8 text-[#16931F]" />
            <p className="mt-3 font-medium">No findings</p>
            <ConnectServiceButton className="mt-4" />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border shadow-none">
          <div className="flex items-center gap-2 border-b bg-muted px-4 py-3 text-sm font-semibold">
            Findings
            <Badge variant="outline" className="text-xs">
              {visible.length}
            </Badge>
          </div>
          {visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No findings match these filters.</p>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((finding) => (
                <li key={finding.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(finding.id)}
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <SeverityIcon severity={finding.severity} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{finding.title}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {finding.serviceName} · {ruleLabel(finding.type)} · {new Date(finding.windowEnd).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className={finding.severity === 'critical' ? 'border-[#F8C7C2] bg-[#FDE8E6] text-[#8A1C13]' : 'border-[#FDE68A] bg-[#FEF3C7] text-[#713F12]'}>
                      {finding.severity}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <FindingDrawer finding={selected} projectId={projectId} organizationSlug={organizationSlug} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function SeverityIcon({ severity }: { severity: FindingSeverity }) {
  return severity === 'critical' ? (
    <AlertTriangle className="h-4 w-4 shrink-0 text-[#8A1C13]" aria-label="Critical" />
  ) : (
    <Clock className="h-4 w-4 shrink-0 text-[#713F12]" aria-label="Warning" />
  );
}
