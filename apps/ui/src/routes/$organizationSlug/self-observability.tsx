import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowRight, BrainCircuit, RefreshCw, Sparkles } from 'lucide-react';
import { useProject } from '~/lib/project-context';
import { api } from '~/lib/api';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { QueryErrorState } from '~/components/query-error-state';

export const Route = createFileRoute('/$organizationSlug/self-observability')({
  component: () => SelfObservabilityPage(),
});

interface DetectionHealthRun {
  id: string;
  projectId: string;
  status: string;
  startedAt: string;
  durationMs: number | null;
  findingsCount: number;
  error: string | null;
}

interface DetectionHealth {
  window: { from: string; to: string };
  totals: {
    runs: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    findings: number;
    successRate: number | null;
    avgDurationMs: number | null;
    maxDurationMs: number | null;
  };
  lastRun: DetectionHealthRun | null;
  recent: DetectionHealthRun[];
}

interface AiUsage {
  quotaEnforced: boolean;
  tokens: { platform: number; byok: number };
  invocations: number;
  limits: { aiTokens: number | null; rcaInvocations: number | null };
  costUsd: { platform: number; byok: number };
  runs: Array<{
    credentialSource: string | null;
    status: string;
    runs: number;
    tokens: number;
    costUsd: number;
  }>;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatUsd(value: number): string {
  if (value >= 100 || value >= 0.01) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1_000)}s`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function statusBadge(status: string) {
  const styles =
    status === 'completed'
      ? 'border-[#1F3D24] bg-[#0F1A12] text-[#4ADE80]'
      : status === 'failed'
        ? 'border-[#4A2C22] bg-[#17100E] text-[#F28B82]'
        : 'border-[#3A3A1F] bg-[#17170E] text-[#E4C465]';
  return (
    <Badge variant="outline" className={styles}>
      {status}
    </Badge>
  );
}

export function SelfObservabilityPage() {
  const { orgId, orgSlug } = useProject();

  const health = useQuery({
    queryKey: ['detection-health', orgId],
    queryFn: () => api.get<DetectionHealth>('/detections/health'),
    enabled: !!orgId,
    refetchInterval: 30_000,
  });

  const usage = useQuery({
    queryKey: ['ai-usage', orgId],
    queryFn: () => api.get<AiUsage>('/ai/usage'),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  if (!orgId) {
    return <div className="p-10 text-center text-sm text-[#989898]">Choose an organization first.</div>;
  }

  const refreshAll = () => {
    void health.refetch();
    void usage.refetch();
  };

  const totals = health.data?.totals;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Activity className="h-5 w-5 text-[#ACFC15]" />
            AI & Ops
          </h1>
          <p className="mt-1 text-xs text-[#989898]">
            Org health for owners and admins: detection engine over the last 24h and AI spend this month.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Detector health */}
      {health.isError ? (
        <QueryErrorState
          title="Detector health unavailable"
          message={(health.error as Error).message}
          onRetry={() => void health.refetch()}
        />
      ) : (
        <Card className="rounded-xl border-[#242426] bg-[#0B0B0C] shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-[#F6F6F6]">
              <BrainCircuit className="h-4 w-4 text-[#ACFC15]" />
              Detection engine · last 24h
            </CardTitle>
            {totals && totals.failed > 0 && (
              <Badge variant="outline" className="border-[#4A2C22] bg-[#17100E] text-[#F28B82]">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {totals.failed} failed run{totals.failed === 1 ? '' : 's'}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Runs" value={String(totals?.runs ?? 0)} />
              <Stat
                label="Success rate"
                value={totals?.successRate == null ? '—' : `${Math.round(totals.successRate * 1000) / 10}%`}
              />
              <Stat label="Failed" value={String(totals?.failed ?? 0)} />
              <Stat label="Avg duration" value={formatDuration(totals?.avgDurationMs ?? null)} />
              <Stat label="Findings" value={String(totals?.findings ?? 0)} />
            </div>

            {health.data?.lastRun ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#242426] bg-[#111113] px-4 py-3 text-xs text-[#989898]">
                <span className="font-medium text-[#F6F6F6]">Last run</span>
                {statusBadge(health.data.lastRun.status)}
                <span>{timeAgo(health.data.lastRun.startedAt)}</span>
                <span>· {formatDuration(health.data.lastRun.durationMs)}</span>
                <span>· {health.data.lastRun.findingsCount} finding{health.data.lastRun.findingsCount === 1 ? '' : 's'}</span>
                <span className="font-mono text-[#6E6E70]">{health.data.lastRun.projectId}</span>
                {health.data.lastRun.error && (
                  <span className="w-full text-[#F28B82]">{health.data.lastRun.error}</span>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-[#242426] bg-[#111113] px-4 py-3 text-xs text-[#6E6E70]">
                No detection runs in the last 24 hours. Runs happen every 15 minutes while detections are enabled.
              </p>
            )}

            {health.data && health.data.recent.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-[#242426]">
                <table className="w-full text-xs">
                  <thead className="bg-[#111113] text-left text-[#6E6E70]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Started</th>
                      <th className="px-3 py-2 font-medium">Project</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Duration</th>
                      <th className="px-3 py-2 text-right font-medium">Findings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1C]">
                    {health.data.recent.map((run) => (
                      <tr key={run.id}>
                        <td className="px-3 py-2 text-[#F6F6F6]">{timeAgo(run.startedAt)}</td>
                        <td className="max-w-[140px] truncate px-3 py-2 font-mono text-[#989898]">{run.projectId}</td>
                        <td className="px-3 py-2">{statusBadge(run.status)}</td>
                        <td className="px-3 py-2 text-[#989898]">{formatDuration(run.durationMs)}</td>
                        <td className="px-3 py-2 text-right text-[#989898]">{run.findingsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI spend */}
      {usage.isError ? (
        <QueryErrorState
          title="AI usage unavailable"
          message={(usage.error as Error).message}
          onRetry={() => void usage.refetch()}
        />
      ) : (
        <Card className="rounded-xl border-[#242426] bg-[#0B0B0C] shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-[#F6F6F6]">
              <Sparkles className="h-4 w-4 text-[#ACFC15]" />
              AI spend · this month
            </CardTitle>
            {orgSlug && (
              <Link
                to="/$organizationSlug/ai"
                params={{ organizationSlug: orgSlug }}
                className="flex items-center gap-1 text-xs text-[#989898] underline-offset-4 hover:text-[#F6F6F6] hover:underline"
              >
                AI provider settings
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Platform cost (est.)" value={formatUsd(usage.data?.costUsd?.platform ?? 0)} />
              <Stat label="BYOK cost (est.)" value={formatUsd(usage.data?.costUsd?.byok ?? 0)} />
              <Stat label="RCA runs" value={String(usage.data?.invocations ?? 0)} />
              <Stat label="Platform tokens" value={formatTokens(usage.data?.tokens.platform ?? 0)} />
              <Stat label="BYOK tokens" value={formatTokens(usage.data?.tokens.byok ?? 0)} />
            </div>
            <p className="text-[11px] text-[#6E6E70]">
              Estimated from provider token price lists, not billing reconciliation.{' '}
              {usage.data?.quotaEnforced ? 'Quota is enforced for platform-funded runs.' : 'Metered only; no quota is enforced.'}
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-[#6E6E70]">
        Prometheus scrape at <code className="rounded bg-[#151517] px-1.5 py-0.5">GET /metrics</code> on the API port exposes the same signals
        (soonwhy.detection.runs, soonwhy.detection.findings, soonwhy.ai.tokens, soonwhy.ai.estimated_cost_usd) for external monitoring.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#242426] bg-[#151517] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[#6E6E70]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#F6F6F6]">{value}</p>
    </div>
  );
}
