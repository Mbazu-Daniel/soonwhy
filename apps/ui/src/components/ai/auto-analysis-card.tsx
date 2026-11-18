import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { api } from '~/lib/api';
import { AUTO_ANALYSIS_KEY, MAX_DAILY_CAP, MAX_MIN_OCCURRENCES, clampInt } from '~/lib/auto-analysis';
import type { AutoAnalysisSettings } from '~/lib/auto-analysis.types';

export function AutoAnalysisCard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: AUTO_ANALYSIS_KEY,
    queryFn: () => api.get<AutoAnalysisSettings>('/ai/auto-analysis'),
  });
  const [dailyCap, setDailyCap] = useState('20');
  const [minOccurrences, setMinOccurrences] = useState('5');

  useEffect(() => {
    if (!settings.data) return;
    setDailyCap(String(settings.data.dailyCap));
    setMinOccurrences(String(settings.data.minOccurrences));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (patch: Partial<Omit<AutoAnalysisSettings, 'capApplies'>>) => api.put<AutoAnalysisSettings>('/ai/auto-analysis', patch),
    onSuccess: (next) => {
      queryClient.setQueryData(AUTO_ANALYSIS_KEY, next);
      toast.success('Auto-analysis updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!settings.data) return null;
  const { enabled, capApplies } = settings.data;
  const commit = () =>
    save.mutate({
      ...(capApplies ? { dailyCap: clampInt(dailyCap, 1, MAX_DAILY_CAP, settings.data.dailyCap) } : {}),
      minOccurrences: clampInt(minOccurrences, 2, MAX_MIN_OCCURRENCES, settings.data.minOccurrences),
    });

  return (
    <Card className="rounded-xl border-[#242426] bg-[#0B0B0C]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#F6F6F6]"><Zap className="h-4 w-4" />Auto-analysis of errors</p>
            <p className="mt-1 text-sm text-[#989898]">
              Analyze important error groups on their own: server errors, thrown exceptions, and groups that keep recurring. Never 404s or scanner probes. Each group is analyzed once and again only when its evidence changes. Runs use your AI provider.
            </p>
          </div>
          <Button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Auto-analysis"
            variant="outline"
            disabled={!canManage || save.isPending}
            onClick={() => save.mutate({ enabled: !enabled })}
            className={enabled ? 'border-[#ACFC15] text-[#ACFC15]' : 'border-[#242426] text-[#989898]'}
          >
            {save.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {enabled ? 'On' : 'Off'}
          </Button>
        </div>
        {enabled && (
          <div className="flex flex-wrap items-end gap-3">
            {capApplies && (
              <div className="space-y-1.5">
                <Label htmlFor="auto-cap">Daily cap</Label>
                <Input id="auto-cap" inputMode="numeric" value={dailyCap} disabled={!canManage} onChange={(event) => setDailyCap(event.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="auto-min">Occurrences to qualify</Label>
              <Input id="auto-min" inputMode="numeric" value={minOccurrences} disabled={!canManage} onChange={(event) => setMinOccurrences(event.target.value)} />
            </div>
            {canManage && <Button type="button" variant="outline" disabled={save.isPending} onClick={commit}>Save limits</Button>}
          </div>
        )}
        {enabled && !capApplies && <p className="text-xs text-[#989898]">You are using your own key, so there is no daily cap.</p>}
        {enabled && <p className="text-xs text-[#989898]">When a critical error is analyzed, your project's alert channels are notified.</p>}
        {!canManage && <p className="text-xs text-[#989898]">Only an owner or admin can change this.</p>}
      </CardContent>
    </Card>
  );
}
