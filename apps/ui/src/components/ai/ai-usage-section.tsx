import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Coins, Wallet } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { MetricCard } from '~/components/metric-cards';
import { ProjectSpendCard } from '~/components/ai/project-spend-card';
import { api } from '~/lib/api';
import { formatTokens, formatUsd } from '~/lib/ai-spend';
import { AI_USAGE_KEY, SPEND_PERIODS, type SpendPeriod } from '~/lib/ai-spend.constants';
import type { AiUsage } from '~/lib/ai-spend.types';

export function AiUsageSection({ organizationSlug }: { organizationSlug: string }) {
  const [period, setPeriod] = useState<SpendPeriod>('month');
  const usage = useQuery({
    queryKey: [AI_USAGE_KEY, period],
    queryFn: () => api.get<AiUsage>(`/ai/usage?period=${period}`),
  });
  const phrase = SPEND_PERIODS.find((item) => item.value === period)?.phrase ?? 'this month';
  const data = usage.data;
  const spent = (data?.costUsd?.platform ?? 0) + (data?.costUsd?.byok ?? 0);
  const tokens = (data?.tokens.platform ?? 0) + (data?.tokens.byok ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select
          aria-label="Period"
          value={period}
          onChange={(event) => setPeriod(event.target.value as SpendPeriod)}
          className="h-8 rounded-md border border-[#242426] bg-transparent px-2 text-xs text-[#F6F6F6]"
        >
          {SPEND_PERIODS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      {usage.isError ? (
        <div className="flex items-center gap-3 text-sm text-[#989898]">
          <span>Could not load AI usage.</span>
          <Button size="sm" variant="outline" onClick={() => void usage.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <MetricCard label={`Spent ${phrase}`} value={formatUsd(spent)} icon={Wallet} />
            <MetricCard label={`Tokens ${phrase}`} value={formatTokens(tokens)} icon={Coins} />
            <MetricCard label={`RCA runs ${phrase}`} value={String(data?.invocations ?? 0)} icon={Bot} />
          </section>
          {data ? (
            <ProjectSpendCard organizationSlug={organizationSlug} projects={data.projects ?? []} periodPhrase={phrase} />
          ) : (
            <p className="text-sm text-[#989898]">Loading AI usage…</p>
          )}
        </>
      )}
    </div>
  );
}
