import { FileJson } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { PayloadReport } from '@soonwhy/shared/contracts';

interface TracePayloadsProps {
  reports?: PayloadReport[];
  onSelectSpan: (spanId: string) => void;
}

function formatBytes(bytes: number): string {
  return bytes >= 1000 ? `${(bytes / 1000).toFixed(1)} KB` : `${bytes} B`;
}

export function TracePayloads({ reports: data, onSelectSpan }: TracePayloadsProps) {
  if (!Array.isArray(data) || !data.length) return null;

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base"><FileJson className="h-4 w-4" />Request and response bodies</CardTitle>
        <p className="text-xs text-muted-foreground">Only field names, types and sizes are stored, never values.</p>
      </CardHeader>
      <CardContent className="p-0">
        {data.map((report) => (
          <button key={`${report.spanId}-${report.side}`} type="button" onClick={() => onSelectSpan(report.spanId)} className="block w-full border-t p-3 text-left first:border-0 hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{report.side}</Badge>
              <span className="text-sm">{report.operation}</span>
              <span className="ml-auto font-mono text-xs">{formatBytes(report.bytes)} · {report.fieldCount} fields</span>
            </div>
            {report.issues.map((issue) => <p key={`${issue.kind}-${issue.path ?? ''}`} className="mt-1 text-xs text-amber-600">{issue.message}</p>)}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
