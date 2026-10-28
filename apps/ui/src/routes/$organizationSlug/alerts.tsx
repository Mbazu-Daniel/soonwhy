import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Bell, Plus, Trash2, Edit3 } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { QueryErrorState } from '~/components/query-error-state';
import { AlertRuleDialog } from '~/components/alerts/alert-rule-dialog';
import { metricLabel, operatorLabel } from '~/components/alerts/alert-constants';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import type { AlertRule, AlertRuleInput } from '~/lib/types';

export const Route = createFileRoute('/$organizationSlug/alerts')({ component: OrgAlertsPage });

function OrgAlertsPage() {
  const { orgId, orgSlug, projectSlug } = useProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const rules = useQuery({
    queryKey: ['org-alert-rules', orgId],
    queryFn: () => api.get<AlertRule[]>('/notifications/alert-rules'),
    enabled: !!orgId,
  });

  const save = useMutation({
    mutationFn: (input: AlertRuleInput) => {
      const body = {
        name: input.name,
        description: input.description,
        conditions: input.conditions,
        minSeverity: input.minSeverity,
        channelIds: input.channelIds,
        dedupeWindowSeconds: input.dedupeWindowSeconds,
        ...(editing ? { status: input.status } : {}),
      };
      return editing
        ? api.put<AlertRule>(`/notifications/alert-rules/${encodeURIComponent(editing.id)}`, body)
        : api.post<AlertRule>('/notifications/alert-rules', body);
    },
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['org-alert-rules', orgId] });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/alert-rules/${encodeURIComponent(id)}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['org-alert-rules', orgId] }),
  });

  if (!orgId) return <div className="p-10 text-center">Choose an organization</div>;
  if (rules.isError) return <QueryErrorState onRetry={() => void rules.refetch()} />;

  const rows = rules.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Organization alert rules</h1>
          <p className="text-xs text-[#989898]">
            These apply across projects.{' '}
            {orgSlug && projectSlug ? (
              <Link to="/$organizationSlug/p/$projectSlug/alerts" params={{ organizationSlug: orgSlug, projectSlug }} className="underline underline-offset-2 hover:text-foreground">
                Project alerts, channels, and history
              </Link>
            ) : null}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormError(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Create alert rule
        </Button>
      </div>

      {rows.length === 0 && !rules.isLoading ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Bell className="mx-auto h-10 w-10 text-[#6E6E70]" />
            <h3 className="mt-3 text-sm font-medium">No organization alert rules</h3>
            <p className="mt-1 text-sm text-[#989898]">Create a rule that applies across every project in this organization.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead className="w-28 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="pl-5">
                    <p className="font-medium">{rule.name}</p>
                    {rule.description ? <p className="mt-0.5 text-xs text-[#989898]">{rule.description}</p> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.minSeverity}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={rule.status === 'active' ? 'text-[#ACFC15] border-[#16931F]' : ''}>
                      {rule.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {rule.conditions.map((condition, index) => (
                        <span key={index} className="rounded border border-[#242426] bg-[#151517] px-2 py-0.5 text-xs text-[#ACFC15]">
                          {metricLabel(condition.metric)} {operatorLabel(condition.operator)} {condition.value} / {condition.window ?? '5m'}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${rule.name}`} onClick={() => { setEditing(rule); setFormError(null); setOpen(true); }}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[#F2555A] hover:bg-[#F2555A]/10 hover:text-[#F2555A]"
                      aria-label={`Delete ${rule.name}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete alert rule ${rule.name}?`)) remove.mutate(rule.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertRuleDialog
        open={open}
        onOpenChange={setOpen}
        rule={editing}
        pending={save.isPending}
        error={formError}
        onSubmit={(input) => save.mutate(input)}
      />
    </div>
  );
}
