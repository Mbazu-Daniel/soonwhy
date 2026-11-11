import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/intelligence/verification')({ component: Verification });

interface VerificationResult { status: 'verified' | 'failed' | 'inconclusive'; score: number; metricComparisons: Array<{ metricName: string; before: number; after: number; changePercent: number; status: 'improved' | 'degraded' | 'neutral'; }>; summary: { passed: number; failed: number; warned: number }; keyInsights: string[]; recommendations: string[]; }

function Verification() {
  const { projectId } = useProject();
  const { data: verifications, isLoading, isError, refetch } = useQuery({
    queryKey: ['verifications', projectId],
    queryFn: () => api.get<VerificationResult[]>(`/projects/${projectId}/intelligence/verifications`),
    enabled: !!projectId,
  });

  if (!projectId) return <Card><CardContent className="p-12 text-center">Choose a project</CardContent></Card>;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-5">
      <Card className="border-border shadow-none">
        <CardHeader className="border-b bg-muted">
          <CardTitle className="text-base">Change Verification</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : !verifications?.length ? (
            <div className="p-12 text-center">
              <Activity className="mx-auto h-8 w-8 text-[#16931F]" />
              <p className="mt-3 font-medium">No verifications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Run verifications to validate changes before and after deployments.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {verifications.map((verification, index) => (
                <VerificationCard key={index} verification={verification} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerificationCard({ verification }: { verification: VerificationResult }) {
  const StatusIcon = verification.status === 'verified' ? CheckCircle2 : verification.status === 'failed' ? XCircle : AlertTriangle;
  const statusColor = verification.status === 'verified' ? 'text-[#16931F]' : verification.status === 'failed' ? 'text-[#8A1C13]' : 'text-[#713F12]';

  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            <h3 className="font-semibold capitalize">{verification.status}</h3>
            <Badge variant="outline">
              Score: {verification.score.toFixed(1)}/10
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
            <div className="rounded bg-secondary p-2">
              <span className="text-muted-foreground">Passed: </span>
              <span className="font-medium text-[#16931F]">{verification.summary.passed}</span>
            </div>
            <div className="rounded bg-secondary p-2">
              <span className="text-muted-foreground">Failed: </span>
              <span className="font-medium text-[#8A1C13]">{verification.summary.failed}</span>
            </div>
            <div className="rounded bg-secondary p-2">
              <span className="text-muted-foreground">Warned: </span>
              <span className="font-medium text-[#713F12]">{verification.summary.warned}</span>
            </div>
          </div>
          {verification.metricComparisons.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium">Metric Comparisons</p>
              {verification.metricComparisons.map((comp, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-secondary p-2 text-xs">
                  <span>{comp.metricName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{comp.before} → {comp.after}</span>
                    <span className={comp.status === 'improved' ? 'text-[#16931F]' : comp.status === 'degraded' ? 'text-[#8A1C13]' : 'text-muted-foreground'}>
                      {comp.changePercent > 0 ? '+' : ''}{comp.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {verification.keyInsights.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium">Key Insights</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {verification.keyInsights.map((insight, i) => (
                  <li key={i}>• {insight}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
