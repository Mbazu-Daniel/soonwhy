import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyProject } from '~/components/empty-state';
import { QueryErrorState } from '~/components/query-error-state';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { FINDING_CATEGORY_LABELS, REPORT_DAY_OPTIONS } from '~/lib/findings.constants';
import type { FindingReport, ReportFinding } from '~/lib/findings.types';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/intelligence/report')({ component: ReportPage });

const FIELD = 'rounded-md border border-border bg-background px-3 py-2 text-sm';

function download(markdown: string, name: string) {
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function ReportPage() {
  const { projectId } = useProject();
  const [days, setDays] = useState(REPORT_DAY_OPTIONS[0]!);
  const { data: report, isLoading, isError, refetch } = useQuery({
    queryKey: ['finding-report', projectId, days],
    queryFn: () => api.get<FindingReport>(`/projects/${projectId}/findings/report?days=${days}`),
    enabled: !!projectId,
  });

  if (!projectId) return <EmptyProject />;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  const copy = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report.markdown);
    toast.success('Report copied');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Findings report</h1>
        <div className="flex items-center gap-2">
          <select aria-label="Period" value={days} onChange={(event) => setDays(Number(event.target.value))} className={FIELD}>
            {REPORT_DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option} days
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={!report} onClick={() => void copy()}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy
          </Button>
          <Button size="sm" variant="outline" disabled={!report} onClick={() => report && download(report.markdown, `findings-report-${report.period.to.slice(0, 10)}.md`)}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </div>

      {isLoading || !report ? (
        <Skeleton className="h-[480px]" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Open" value={report.totals.open} note={`${report.totals.openCritical} critical`} />
            <Stat label="New" value={report.totals.newInPeriod} note={`last ${days} days`} />
            <Stat label="Resolved" value={report.totals.resolvedInPeriod} note={`last ${days} days`} />
            <Stat label="Ignored" value={report.totals.ignored} note="all time" />
          </div>

          <Card className="overflow-hidden shadow-none">
            <div className="border-b bg-muted px-4 py-3 text-sm font-semibold">By category</div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Open</th>
                  <th className="px-4 py-2 font-medium">Resolved</th>
                  <th className="px-4 py-2 font-medium">Ignored</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.byCategory.map((row) => (
                  <tr key={row.category}>
                    <td className="px-4 py-2">{FINDING_CATEGORY_LABELS[row.category]}</td>
                    <td className="px-4 py-2">{row.open}</td>
                    <td className="px-4 py-2">{row.resolved}</td>
                    <td className="px-4 py-2">{row.ignored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <FindingList title="Open findings" empty="Nothing open." findings={report.topOpen} />
          <FindingList title="Resolved in this period" empty="Nothing was resolved in this period." findings={report.resolved} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function FindingList({ title, empty, findings }: { title: string; empty: string; findings: ReportFinding[] }) {
  return (
    <Card className="overflow-hidden shadow-none">
      <div className="border-b bg-muted px-4 py-3 text-sm font-semibold">{title}</div>
      {findings.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {findings.map((finding) => (
            <li key={finding.id} className="space-y-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{finding.title}</p>
                <Badge variant="outline">{finding.severity}</Badge>
                <Badge variant="outline">{FINDING_CATEGORY_LABELS[finding.category]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {finding.serviceName} · seen {finding.occurrences}x · last seen {new Date(finding.lastSeenAt).toLocaleDateString()}
              </p>
              {finding.recommendation && <p className="text-sm leading-6">{finding.recommendation}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
