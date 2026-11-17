import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { QueryErrorState } from '~/components/query-error-state';
import { ignoreRuleBody, ignoreRuleProblem } from '~/lib/ignore-rules';
import type { ErrorIgnoreRule, IgnoreRuleDraft } from '~/lib/ignore-rules.types';
import { useSettingsMemberContext } from './organization-section';

const EMPTY: IgnoreRuleDraft = { pathPattern: '', status: '' };

export function ErrorRulesSection() {
  const queryClient = useQueryClient();
  const { orgId, projectId } = useProject();
  const { canManage } = useSettingsMemberContext(orgId);
  const [draft, setDraft] = useState<IgnoreRuleDraft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const key = ['error-ignore-rules', projectId];

  const rules = useQuery({
    queryKey: key,
    queryFn: () => api.get<ErrorIgnoreRule[]>(`/projects/${projectId}/error-ignore-rules`),
    enabled: !!projectId,
  });

  const reset = () => {
    setDraft(EMPTY);
    setEditingId(null);
  };
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ['project-errors', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['project-errors-inventory', projectId] });
  };

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? api.put(`/projects/${projectId}/error-ignore-rules/${editingId}`, ignoreRuleBody(draft))
        : api.post(`/projects/${projectId}/error-ignore-rules`, ignoreRuleBody(draft)),
    onSuccess: () => {
      toast.success(editingId ? 'Rule updated' : 'Rule added');
      reset();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/error-ignore-rules/${id}`),
    onSuccess: () => {
      toast.success('Rule removed');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const problem = draft.pathPattern ? ignoreRuleProblem(draft) : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ignoreRuleProblem(draft)) save.mutate();
  };

  if (!projectId) return <p className="text-sm text-[#989898]">Choose a project to manage its ignore rules.</p>;
  if (rules.isError) return <QueryErrorState onRetry={() => void rules.refetch()} />;

  return (
    <Card className="border-[#242426] bg-[#0B0B0C]">
      <CardHeader>
        <CardTitle className="text-base">Ignore rules</CardTitle>
        <p className="text-sm text-[#989898]">
          Hide error groups from this project's Errors page when the request path matches. Use * as a wildcard. A rule only matches paths you name, so a 404 on any other route still shows.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {canManage && (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="ignore-path">Path pattern</Label>
              <Input id="ignore-path" placeholder="/internal/*" value={draft.pathPattern} onChange={(event) => setDraft({ ...draft, pathPattern: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ignore-status">Status (optional)</Label>
              <Input id="ignore-status" placeholder="404" inputMode="numeric" maxLength={3} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!draft.pathPattern || !!ignoreRuleProblem(draft) || save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingId ? 'Save' : 'Add rule'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={reset} aria-label="Cancel edit">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {problem && <p className="text-xs text-[#F28B82] sm:col-span-3">{problem}</p>}
          </form>
        )}

        {rules.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#989898]" />
        ) : !rules.data?.length ? (
          <p className="text-sm text-[#989898]">No ignore rules yet.</p>
        ) : (
          <ul className="divide-y divide-[#1B1B1D] rounded-lg border border-[#242426]">
            {rules.data.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{rule.pathPattern}</p>
                  <p className="text-xs text-[#989898]">{rule.status ? `Only status ${rule.status}` : 'Any status'}</p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(rule.id); setDraft({ pathPattern: rule.pathPattern, status: rule.status ?? '' }); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(rule.id)} className="border-[#4A2C22] text-[#F28B82]">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Remove
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
