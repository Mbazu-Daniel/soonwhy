import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { AutoAnalysisCard } from "~/components/ai/auto-analysis-card";
import { ProviderModal } from "~/components/ai/provider-modal";
import { AI_CATALOG_KEY, AI_CREDENTIALS_KEY } from "~/lib/ai-providers.constants";
import type { AiCredential, AiCredentialList, CatalogProvider } from "~/lib/ai-providers.types";
import { QueryErrorState } from "~/components/query-error-state";
import { api } from "~/lib/api";
import { AI_USAGE_KEY } from "~/lib/ai-spend.constants";
import { AiUsageSection } from "~/components/ai/ai-usage-section";

export const Route = createFileRoute("/$organizationSlug/ai")({
  component: () => AIProvidersPage(),
});

function AIProvidersPage() {
  const { organizationSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AiCredential | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const list = useQuery({
    queryKey: AI_CREDENTIALS_KEY,
    queryFn: () => api.get<AiCredentialList>("/ai/credentials"),
  });
  const catalog = useQuery({
    queryKey: AI_CATALOG_KEY,
    queryFn: () => api.get<{ providers: CatalogProvider[] }>("/ai/providers"),
    staleTime: 5 * 60_000,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: AI_CREDENTIALS_KEY });
    void queryClient.invalidateQueries({ queryKey: [AI_USAGE_KEY] });
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/ai/credentials/${id}`),
    onSuccess: refresh,
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => api.patch(`/ai/credentials/${id}`, { isDefault: true }),
    onSuccess: refresh,
  });

  if (list.isError) {
    return <QueryErrorState onRetry={() => void list.refetch()} />;
  }
  if (!list.data) {
    return (
      <div className="flex w-full items-center gap-2 px-4 py-10 text-sm text-[#989898] sm:px-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading AI providers…
      </div>
    );
  }

  const { credentials, canManage } = list.data;
  const open = (credential: AiCredential | null) => {
    setEditing(credential);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto w-full space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F6F6F6]">AI Providers</h1>
          <p className="mt-1 text-sm text-[#989898]">
            Models this workspace can use for AI analysis. The default runs unless you pick another.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => open(null)} className="bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90">
            <Plus className="mr-2 h-4 w-4" />
            Add provider
          </Button>
        )}
      </div>

      {canManage && <AiUsageSection organizationSlug={organizationSlug} />}

      <AutoAnalysisCard canManage={canManage} />

      {credentials.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {credentials.map((item) => {
            const entry = catalog.data?.providers.find((candidate) => candidate.id === item.provider);
            const shownUrl = item.baseUrl ?? entry?.baseUrl ?? null;
            return (
              <Card key={item.id} className="rounded-xl border-[#242426] bg-[#0B0B0C]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F6F6F6]">{item.name}</p>
                      <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#989898]">
                        {item.model}
                      </p>
                      {shownUrl && <p className="mt-2 truncate font-mono text-[11px] text-[#6E6E70]">{shownUrl}</p>}
                    </div>
                    {item.isDefault && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#ACFC15]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#ACFC15]">
                        <Star className="h-3 w-3" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#ACFC15]">
                    Key stored · {item.keyHint}
                  </p>
                  {canManage && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#1B1B1D] pt-4">
                      <Button type="button" variant="outline" size="sm" onClick={() => open(item)} className="border-[#242426] text-[#F6F6F6]">
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      {!item.isDefault && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={makeDefault.isPending}
                          onClick={() => makeDefault.mutate(item.id)}
                          className="border-[#242426] text-[#F6F6F6]"
                        >
                          Make default
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(item.id)}
                        className="border-[#4A2C22] text-[#F28B82]"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-[#242426] p-10 text-center">
          <Bot className="mx-auto h-8 w-8 text-[#6E6E70]" />
          <p className="mt-3 text-sm font-medium text-[#F6F6F6]">No provider yet</p>
          <p className="mt-1 text-xs text-[#989898]">
            {canManage ? "Add one to enable AI analysis on your own model and key." : "An owner or admin can add one."}
          </p>
          {canManage && (
            <Button onClick={() => open(null)} className="mt-4 bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90">
              <Plus className="mr-2 h-4 w-4" />
              Add provider
            </Button>
          )}
        </div>
      )}

      {(remove.isError || makeDefault.isError) && (
        <p className="text-xs text-[#F28B82]">{((remove.error ?? makeDefault.error) as Error).message}</p>
      )}

      <ProviderModal open={dialogOpen} onOpenChange={setDialogOpen} current={editing} onSaved={refresh} />
    </div>
  );
}
