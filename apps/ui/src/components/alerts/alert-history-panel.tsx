import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { QueryErrorState } from '~/components/query-error-state';
import { api } from '~/lib/api';
import type { AlertRule, NotificationLogPage } from '~/lib/types';

interface AlertHistoryPanelProps {
  projectId: string;
  rules: AlertRule[];
}

export function AlertHistoryPanel({ projectId, rules }: AlertHistoryPanelProps) {
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const logs = useQuery({
    queryKey: ['notification-logs', projectId, offset],
    queryFn: () =>
      api.get<NotificationLogPage>(
        `/projects/${projectId}/notifications/logs?limit=${limit}&offset=${offset}`,
      ),
  });

  if (logs.isError) return <QueryErrorState onRetry={() => void logs.refetch()} />;

  const items = logs.data?.items ?? [];
  const names = new Map(rules.map((rule) => [rule.id, rule.name]));

  if (!logs.isLoading && items.length === 0 && offset === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <ScrollText className="mx-auto h-10 w-10 text-[#6E6E70]" />
          <h3 className="mt-3 text-sm font-medium">No alert deliveries yet</h3>
          <p className="mt-1 text-sm text-[#989898]">When a rule fires, delivery attempts to email, Slack, and webhooks show up here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Time</TableHead>
              <TableHead>Alert</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-5">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="pl-5 text-sm text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">{log.title ?? (log.alertRuleId ? names.get(log.alertRuleId) : null) ?? 'Alert'}</TableCell>
                <TableCell className="capitalize text-sm">{log.channelType}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={log.status === 'sent' ? 'text-[#ACFC15] border-[#16931F]' : log.status === 'failed' ? 'text-[#F2555A] border-[#F2555A]' : ''}>
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="pr-5 text-xs text-muted-foreground">{log.error ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - limit))}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={!logs.data?.hasMore} onClick={() => setOffset((value) => value + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}
