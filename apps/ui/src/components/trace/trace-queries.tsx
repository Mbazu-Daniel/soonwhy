import { Database } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { formatMs } from '~/lib/format-ms';
import type { TraceQuerySummary } from '@soonwhy/shared/contracts';

interface TraceQueriesProps {
  summary?: TraceQuerySummary;
  onSelectSpan: (spanId: string) => void;
}

export function TraceQueries({ summary: data, onSelectSpan }: TraceQueriesProps) {
  if (!data?.queries?.length) return null;

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" />Database queries</CardTitle>
        <p className="text-xs text-muted-foreground">{data.queryCount} queries took {formatMs(data.totalQueryMs)} of this request. Values are redacted.</p>
      </CardHeader>
      <CardContent className="p-0">
        {data.queries.map((item) => (
          <button key={item.query} type="button" onClick={() => onSelectSpan(item.spanId)} className="block w-full border-t p-3 text-left first:border-0 hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{item.operation || 'QUERY'}</Badge>
              {item.count > 1 ? <span className="text-xs text-muted-foreground">×{item.count}</span> : null}
              <span className="ml-auto font-mono text-xs">{formatMs(item.totalMs)} · {Math.round(item.shareOfTrace * 100)}%</span>
            </div>
            <p className="mt-1 break-all font-mono text-[11px]">{item.query}</p>
            {item.hints.map((hint) => <p key={hint.kind} className="mt-1 text-xs text-amber-600">{hint.message}</p>)}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
