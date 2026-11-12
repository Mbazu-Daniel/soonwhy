import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Coins, Loader2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { MetricCard } from "~/components/metric-cards";
import { ProviderDialog } from "~/components/ai/provider-dialog";
import { QueryErrorState } from "~/components/query-error-state";
import { api } from "~/lib/api";

export const Route = createFileRoute("/$organizationSlug/ai")({
  component: () => AIProvidersPage(),
});

interface AiConfig {
  configured: boolean;
  canManage: boolean;
  provider?: string;
  model?: string;
  baseUrl?: string | null;
  keyHint?: string;
  verifiedAt?: string | null;
  lastErrorCode?: string | null;
}

interface ProviderList {
  providers: Array<{ id: string; label: string; baseUrl: string | null }>;
}

interface Usage {
  tokens: { platform: number; byok: number };
  invocations: number;
  costUsd: { platform: number; byok: number };
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatUsd(value: number): string {
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function AIProvidersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const config = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => api.get<AiConfig>("/ai/config"),
  });
  const catalog = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.get<ProviderList>("/ai/providers"),
    staleTime: 5 * 60_000,
  });
  const usage = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => api.get<Usage>("/ai/usage"),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["ai-config"] });
    void queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    void queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
  };

  const remove = useMutation({
    mutationFn: () => api.delete("/ai/config"),
    onSuccess: refresh,
  });

  if (config.isError) {
    return <QueryErrorState onRetry={() => void config.refetch()} />;
  }
  if (!config.data) {
    return (
      <div className="flex w-full items-center gap-2 px-4 py-10 text-sm text-[#989898] sm:px-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading AI providers…
      </div>
    );
  }

  const data = config.data;
  const canManage = data.canManage;
  const spent =
    (usage.data?.costUsd?.platform ?? 0) + (usage.data?.costUsd?.byok ?? 0);
  const tokens =
    (usage.data?.tokens.platform ?? 0) + (usage.data?.tokens.byok ?? 0);
  const providerEntry = catalog.data?.providers.find(
    (item) => item.id === data.provider,
  );
  const providerLabel = providerEntry?.label ?? data.provider ?? "Provider";
  const shownUrl = data.baseUrl ?? providerEntry?.baseUrl ?? null;

  return (
    <div className="mx-auto w-full space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F6F6F6]">
            AI Providers
          </h1>
          <p className="mt-1 text-sm text-[#989898]">
            The model this workspace uses for AI analysis.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90"
          >
            {data.configured ? (
              <Pencil className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {data.configured ? "Edit provider" : "Add provider"}
          </Button>
        )}
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Spent this month"
          value={formatUsd(spent)}
          icon={Wallet}
        />
        <MetricCard
          label="Tokens this month"
          value={formatTokens(tokens)}
          icon={Coins}
        />
        <MetricCard
          label="RCA runs"
          value={String(usage.data?.invocations ?? 0)}
          icon={Bot}
        />
      </section>

      {data.configured ? (
        <Card className="rounded-xl border-[#242426] bg-[#0B0B0C]">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#F6F6F6]">
                  {providerLabel}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#989898]">
                  {data.model}
                </p>
                {shownUrl && (
                  <p className="mt-2 truncate font-mono text-[11px] text-[#6E6E70]">
                    {shownUrl}
                  </p>
                )}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#ACFC15]">
                Key stored · {data.keyHint}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#1B1B1D] pt-4">
              <p className="text-[11px] text-[#6E6E70]">
                {data.verifiedAt
                  ? `Verified ${new Date(data.verifiedAt).toLocaleString()}`
                  : data.lastErrorCode
                    ? `Last check failed: ${data.lastErrorCode}`
                    : "Not verified yet"}
              </p>
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOpen(true)}
                    className="border-[#242426] text-[#F6F6F6]"
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove.mutate()}
                    disabled={remove.isPending}
                    className="border-[#4A2C22] text-[#F28B82]"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {remove.isPending ? "Removing…" : "Remove"}
                  </Button>
                </div>
              )}
            </div>
            {remove.isError && (
              <p className="mt-3 text-xs text-[#F28B82]">
                {(remove.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-[#242426] p-10 text-center">
          <Bot className="mx-auto h-8 w-8 text-[#6E6E70]" />
          <p className="mt-3 text-sm font-medium text-[#F6F6F6]">
            No provider yet
          </p>
          <p className="mt-1 text-xs text-[#989898]">
            {canManage
              ? "Add one to enable AI analysis on your own model and key."
              : "An owner or admin can add one."}
          </p>
          {canManage && (
            <Button
              onClick={() => setDialogOpen(true)}
              className="mt-4 bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add provider
            </Button>
          )}
        </div>
      )}

      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        current={data}
        onSaved={refresh}
      />
    </div>
  );
}
