import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { TimeSeriesChart } from '~/components/time-series-chart';
import { AlertTriangle, ArrowLeft, Copy, ExternalLink } from 'lucide-react';

export const Route = createFileRoute('/dashboard/errors')({
  component: ErrorOverview,
});

interface ErrorEntry {
  id: string;
  message: string;
  stack?: string;
  service: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  status: 'new' | 'ongoing' | 'resolved';
}

const MOCK_ERRORS: ErrorEntry[] = [
  {
    id: '1',
    message: 'TypeError: Cannot read properties of undefined (reading \'map\')',
    stack: `TypeError: Cannot read properties of undefined (reading 'map')
  at renderList (src/components/UserList.tsx:42:18)
  at renderWithHooks (node_modules/react-dom/src/hooks.js:149:18)
  at mountIndeterminateComponent (node_modules/react-dom/src/react-dom.js:16827:13)`,
    service: 'api-gateway',
    count: 847,
    firstSeen: '2026-08-20T10:00:00Z',
    lastSeen: '2026-09-02T14:23:00Z',
    status: 'ongoing',
  },
  {
    id: '2',
    message: 'Connection refused: Redis at 127.0.0.1:6379',
    stack: `Error: connect ECONNREFUSED 127.0.0.1:6379
  at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1595:16)`,
    service: 'auth-service',
    count: 23,
    firstSeen: '2026-09-02T08:00:00Z',
    lastSeen: '2026-09-02T08:15:00Z',
    status: 'resolved',
  },
  {
    id: '3',
    message: 'Payment gateway timeout: 30s exceeded',
    stack: `TimeoutError: Operation timed out after 30000ms
  at Timeout._onTimeout (src/services/payment.ts:78:12)
  at listOnTimeout (node:internal/timers:569:17)`,
    service: 'payment-service',
    count: 156,
    firstSeen: '2026-09-01T22:00:00Z',
    lastSeen: '2026-09-02T14:20:00Z',
    status: 'ongoing',
  },
  {
    id: '4',
    message: 'Rate limit exceeded: 1000 requests/min',
    service: 'api-gateway',
    count: 1203,
    firstSeen: '2026-08-25T00:00:00Z',
    lastSeen: '2026-09-02T14:00:00Z',
    status: 'new',
  },
];

function ErrorStatusBadge({ status }: { status: ErrorEntry['status'] }) {
  const variants = {
    new: 'bg-red-500/10 text-red-500 border-red-500/20',
    ongoing: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    resolved: 'bg-green-500/10 text-green-500 border-green-500/20',
  };
  return (
    <Badge variant="outline" className={variants[status]}>
      {status}
    </Badge>
  );
}

function ErrorDetail({ error, onBack }: { error: ErrorEntry; onBack: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(error.stack || error.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Stable mock data — seeded by error id so it doesn't flicker on re-render
  const occurrences = useMemo(() => {
    const seed = error.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Array.from({ length: 24 }, (_, i) => {
      const pseudoRandom = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
      return {
        timestamp: Date.now() - (23 - i) * 60 * 60 * 1000,
        value: Math.floor(pseudoRandom * 50) + (error.status === 'resolved' ? 0 : 10),
      };
    });
  }, [error.id, error.status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold font-mono">{error.message}</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{error.service}</span>
            <span>{error.count} occurrences</span>
            <span>First: {new Date(error.firstSeen).toLocaleString()}</span>
            <span>Last: {new Date(error.lastSeen).toLocaleString()}</span>
          </div>
        </div>
        <ErrorStatusBadge status={error.status} />
      </div>

      <TimeSeriesChart
        title="Error Occurrences (24h)"
        data={occurrences}
        color="hsl(0, 84%, 60%)"
      />

      {error.stack && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Stack Trace</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="text-sm font-mono bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
              {error.stack}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI root cause analysis will appear here once connected to the backend.
            The system will correlate this error with related logs, traces, and deployment events.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorOverview() {
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);

  if (selectedError) {
    return <ErrorDetail error={selectedError} onBack={() => setSelectedError(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Errors</h2>
        <p className="text-muted-foreground">Track and debug application errors</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Errors</p>
            <p className="text-2xl font-bold mt-1">2,229</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">New</p>
            <p className="text-2xl font-bold mt-1 text-red-500">1</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ongoing</p>
            <p className="text-2xl font-bold mt-1 text-yellow-500">2</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Resolved</p>
            <p className="text-2xl font-bold mt-1 text-green-500">1</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {MOCK_ERRORS.map((error) => (
              <button
                key={error.id}
                className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedError(error)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm truncate">{error.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{error.service}</span>
                      <span>{error.count} occurrences</span>
                      <span>Last: {new Date(error.lastSeen).toLocaleString()}</span>
                    </div>
                  </div>
                  <ErrorStatusBadge status={error.status} />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
