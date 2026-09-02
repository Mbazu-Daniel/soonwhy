import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '~/components/ui/card';
import { HealthScore } from '~/components/health-score';
import { MetricCard } from '~/components/metric-cards';
import { Activity, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
});

function DashboardOverview() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <HealthScore score={0} />
        <Card>
          <CardContent className="p-6 flex items-center justify-center h-24">
            <p className="text-sm text-muted-foreground">No data yet</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Requests" value="—" icon={Activity} />
        <MetricCard label="Request Rate" value="—" icon={TrendingUp} />
        <MetricCard label="Error Rate" value="—" icon={AlertTriangle} />
        <MetricCard label="P95 Latency" value="—" icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Latency Distribution</p>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P50</span><span className="font-mono text-sm">—</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P95</span><span className="font-mono text-sm">—</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P99</span><span className="font-mono text-sm">—</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Status Codes</p>
            <div className="flex items-center justify-between"><span className="text-sm">2xx</span><span className="font-mono text-sm">—</span></div>
            <div className="flex items-center justify-between"><span className="text-sm">3xx</span><span className="font-mono text-sm">—</span></div>
            <div className="flex items-center justify-between"><span className="text-sm">4xx</span><span className="font-mono text-sm">—</span></div>
            <div className="flex items-center justify-between"><span className="text-sm">5xx</span><span className="font-mono text-sm">—</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
