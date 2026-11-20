import { Lightbulb } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { TraceInsights as TraceInsightsData } from '@soonwhy/shared/contracts';
import { INSIGHT_SEVERITY_CLASS } from '~/lib/trace-insights.constants';

interface TraceInsightsProps {
  insights?: TraceInsightsData;
  onSelectSpan: (spanId: string) => void;
}

export function TraceInsights({ insights, onSelectSpan }: TraceInsightsProps) {
  if (!insights || !insights.findings?.length) return null;

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4" />What to fix first</CardTitle>
        <p className="text-xs text-muted-foreground">Found by reading how the {Math.round(insights.durationMs)} ms of this request was spent.</p>
      </CardHeader>
      <CardContent className="p-0">
        {insights.findings.map((finding) => (
          <button key={`${finding.kind}-${finding.spanIds[0]}`} type="button" onClick={() => onSelectSpan(finding.spanIds[0]!)} className="block w-full border-t p-3 text-left first:border-0 hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={INSIGHT_SEVERITY_CLASS[finding.severity]}>{finding.severity}</Badge>
              <span className="text-sm font-medium">{finding.title}</span>
              <span className="ml-auto font-mono text-xs">{Math.round(finding.impactMs)} ms</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{finding.detail}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
