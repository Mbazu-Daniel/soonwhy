import { cn } from '~/lib/utils';
import { Card, CardContent } from '~/components/ui/card';

interface HealthScoreProps {
  score: number;
  className?: string;
}

export function HealthScore({ score, className }: HealthScoreProps) {
  const color =
    score >= 80
      ? { text: 'text-green-500', bg: 'bg-green-500', ring: 'stroke-green-500' }
      : score >= 50
      ? { text: 'text-yellow-500', bg: 'bg-yellow-500', ring: 'stroke-yellow-500' }
      : { text: 'text-destructive', bg: 'bg-destructive', ring: 'stroke-destructive' };

  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn('relative h-24 w-24', className)}>
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={color.ring}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-2xl font-bold', color.text)}>{score}</span>
      </div>
    </div>
  );
}

interface ApplicationSummaryProps {
  healthScore: number;
  requestRate?: number;
  errorRate?: number;
  className?: string;
}

export function ApplicationSummary({
  healthScore,
  requestRate,
  errorRate,
  className,
}: ApplicationSummaryProps) {
  const status =
    healthScore >= 80
      ? { text: 'Your application is healthy.', color: 'text-green-500' }
      : healthScore >= 50
      ? { text: 'Your application needs attention.', color: 'text-yellow-500' }
      : { text: 'Your application has critical issues.', color: 'text-destructive' };

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center gap-6">
          <HealthScore score={healthScore} />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{status.text}</h3>
            <p className="text-sm text-muted-foreground">
              {requestRate !== undefined && errorRate !== undefined
                ? `${requestRate.toFixed(1)} req/s with ${errorRate.toFixed(2)}% error rate.`
                : 'Install the SDK to start monitoring.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AISummaryProps {
  summary?: string;
  className?: string;
}

export function AISummary({ summary, className }: AISummaryProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary text-sm font-bold">AI</span>
          </div>
          <div>
            <p className="text-sm font-medium">AI Summary</p>
            <p className="text-sm text-muted-foreground mt-1">
              {summary ||
                'AI analysis will appear here once telemetry data is available. The AI will provide evidence-backed insights about your application\'s health.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
