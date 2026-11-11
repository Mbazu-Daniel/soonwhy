import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, TrendingUp, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/intelligence/recommendations')({ component: Recommendations });

interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: string;
  effort: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  expectedSignal?: { metricName: string; before: number; after: number };
}

function Recommendations() {
  const { projectId } = useProject();
  const { data: recommendations, isLoading, isError, refetch } = useQuery({
    queryKey: ['recommendations', projectId],
    queryFn: () => api.get<Recommendation[]>(`/projects/${projectId}/intelligence/recommendations`),
    enabled: !!projectId,
  });

  if (!projectId) return <Card><CardContent className="p-12 text-center">Choose a project</CardContent></Card>;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-5">
      <Card className="border-border shadow-none">
        <CardHeader className="border-b bg-muted">
          <CardTitle className="text-base">Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : !recommendations?.length ? (
            <div className="p-12 text-center">
              <Lightbulb className="mx-auto h-8 w-8 text-[#16931F]" />
              <p className="mt-3 font-medium">No recommendations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Recommendations will appear based on detection findings.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const priorityColors = {
    critical: 'border-[#8A1C13] bg-[#FDE8E6] text-[#8A1C13]',
    high: 'border-[#713F12] bg-[#FEF3C7] text-[#713F12]',
    medium: 'border-[#34451D] bg-[#F7FAF4] text-[#34451D]',
    low: 'border-[#24404A] bg-[#E8F4F8] text-[#24404A]',
  };

  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{recommendation.title}</h3>
            <Badge variant="outline" className={priorityColors[recommendation.priority]}>
              {recommendation.priority}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {recommendation.category}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{recommendation.description}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-[#16931F]" />
              <span>Impact: {recommendation.impact}</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-[#16931F]" />
              <span>Effort: {recommendation.effort}</span>
            </div>
            <span>Confidence: {(recommendation.confidence * 100).toFixed(0)}%</span>
          </div>
          {recommendation.expectedSignal && (
            <div className="mt-3 rounded bg-secondary p-3 text-xs">
              <p className="font-medium">Expected Signal</p>
              <p className="mt-1 text-muted-foreground">
                {recommendation.expectedSignal.metricName}: {recommendation.expectedSignal.before} → {recommendation.expectedSignal.after}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
