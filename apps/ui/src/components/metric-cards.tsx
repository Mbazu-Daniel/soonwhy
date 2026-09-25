import { cn } from '~/lib/utils';
import { Card, CardContent } from '~/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Trend {
  value: number;
  direction: 'up' | 'down' | 'flat';
  isGood?: boolean;
}

interface MetricCardProps {
  label: string;
  value: string;
  trend?: Trend;
  icon?: React.ElementType;
  className?: string;
}

function getTrendColor(trend: Trend) {
  if (trend.direction === 'flat') return 'text-muted-foreground';
  const upIsGood = trend.isGood ?? true;
  if (trend.direction === 'up') return upIsGood ? 'text-[#16931F]' : 'text-[#8A1C13]';
  return upIsGood ? 'text-[#8A1C13]' : 'text-[#16931F]';
}

function TrendIcon({ direction }: { direction: Trend['direction'] }) {
  if (direction === 'up') return <TrendingUp className="h-3 w-3" />;
  if (direction === 'down') return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

export function MetricCard({ label, value, trend, icon: Icon, className }: MetricCardProps) {
  return (
    <Card className={cn('bg-white', className)}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight mt-1">{value}</p>
            {trend && (
              <div className={cn('flex items-center gap-1 mt-1.5 text-xs', getTrendColor(trend))}>
                <TrendIcon direction={trend.direction} />
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="h-10 w-10 shrink-0 rounded-lg bg-[#EDF3E9] flex items-center justify-center">
              <Icon className="h-4.5 w-4.5 text-[#16931F]" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface StatusCodeBreakdownProps {
  codes: { label: string; percentage: number; color: string }[];
  className?: string;
}

export function StatusCodeBreakdown({ codes, className }: StatusCodeBreakdownProps) {
  return (
    <Card className={cn('bg-white', className)}>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium">Status Codes</p>
        {codes.map((code) => (
          <div key={code.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('h-2 w-2 rounded-full', code.color)} />
              <span className="text-sm">{code.label}</span>
            </div>
            <span className="font-mono text-sm">{code.percentage}%</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface LatencyDistributionProps {
  p50: number;
  p95: number;
  p99: number;
  className?: string;
}

export function LatencyDistribution({ p50, p95, p99, className }: LatencyDistributionProps) {
  return (
    <Card className={cn('bg-white', className)}>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium">Latency Distribution</p>
        {[
          { label: 'P50', value: p50 },
          { label: 'P95', value: p95 },
          { label: 'P99', value: p99 },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="font-mono text-sm">{item.value}ms</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
