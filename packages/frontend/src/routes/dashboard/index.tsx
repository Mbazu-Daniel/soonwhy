import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { HealthScore, AISummary } from '~/components/health-score';
import { MetricCard, LatencyDistribution, StatusCodeBreakdown } from '~/components/metric-cards';
import { Activity, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
});

// Mock data — replaced with real ClickHouse queries in Phase 4
const MOCK = {
  healthScore: 87,
  totalRequests: 124583,
  requestRate: 42.3,
  errorCount: 23,
  errorRate: 0.18,
  latencyP50: 45,
  latencyP95: 180,
  latencyP99: 420,
  statusCodes: [
    { label: '2xx', percentage: 98.2, color: 'bg-green-500' },
    { label: '3xx', percentage: 1.1, color: 'bg-blue-500' },
    { label: '4xx', percentage: 0.5, color: 'bg-yellow-500' },
    { label: '5xx', percentage: 0.2, color: 'bg-destructive' },
  ],
};

function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Overview</h2>
        <p className="text-muted-foreground">Application health and key metrics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <HealthScore score={MOCK.healthScore} />
        <AISummary />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Requests"
          value={MOCK.totalRequests.toLocaleString()}
          trend={{ value: 12, direction: 'up', isGood: true }}
          icon={Activity}
        />
        <MetricCard
          label="Request Rate"
          value={`${MOCK.requestRate}/s`}
          trend={{ value: 3, direction: 'up', isGood: true }}
          icon={TrendingUp}
        />
        <MetricCard
          label="Error Rate"
          value={`${MOCK.errorRate}%`}
          trend={{ value: 5, direction: 'down', isGood: true }}
          icon={AlertTriangle}
        />
        <MetricCard
          label="P95 Latency"
          value={`${MOCK.latencyP95}ms`}
          trend={{ value: 2, direction: 'flat' }}
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LatencyDistribution p50={MOCK.latencyP50} p95={MOCK.latencyP95} p99={MOCK.latencyP99} />
        <StatusCodeBreakdown codes={MOCK.statusCodes} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <p>
              Install the SDK to start seeing real data.{' '}
              <span className="text-foreground font-medium">Add your API key</span> to your application config.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
