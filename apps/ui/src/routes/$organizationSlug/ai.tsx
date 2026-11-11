import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ModelPicker,
  type CatalogProvider,
} from "~/components/ai/model-picker";
import { QueryErrorState } from "~/components/query-error-state";
import { api, apiProblem } from "~/lib/api";

export const Route = createFileRoute("/$organizationSlug/ai")({
  component: () => AIAgentPage(),
});

type CredentialSource = "byok" | "platform" | "none";

interface PlatformInfo {
  configured: boolean;
  provider: string | null;
  model: string | null;
}

interface AiConfig {
  configured: boolean;
  canManage: boolean;
  activeSource: CredentialSource;
  platform: PlatformInfo;
  provider?: string;
  model?: string;
  baseUrl?: string | null;
  keyHint?: string;
  verifiedAt?: string | null;
  lastErrorCode?: string | null;
}

interface ProviderList {
  providers: CatalogProvider[];
  platform: PlatformInfo;
  activeSource: CredentialSource;
  canManage: boolean;
  quotaEnforced: boolean;
}

interface ConnectionResult {
  ok: boolean;
  checkable: boolean;
  code: string;
  detail: string;
  checkedAt: string;
}

interface SaveResult {
  provider: string;
  model: string;
  keyHint: string;
  warnings: string[];
}

interface Usage {
  quotaEnforced: boolean;
  tokens: { platform: number; byok: number };
  invocations: number;
  limits: { aiTokens: number | null; rcaInvocations: number | null };
  costUsd: { platform: number; byok: number };
  runs: Array<{
    credentialSource: string | null;
    status: string;
    runs: number;
    tokens: number;
    costUsd: number;
  }>;
}

const SOURCE_LABEL: Record<CredentialSource, string> = {
  byok: "Your key",
  platform: "Platform key",
  none: "Nothing configured",
};

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatUsd(value: number): string {
  if (value >= 100) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function AIAgentPage() {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quotaMetric, setQuotaMetric] = useState<
    "ai_tokens" | "rca_invocations"
  >("ai_tokens");
  const [quotaLimit, setQuotaLimit] = useState("");

  const config = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => api.get<AiConfig>("/ai/config"),
  });
  const providers = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.get<ProviderList>("/ai/providers"),
    staleTime: 5 * 60_000,
  });
  const usage = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => api.get<Usage>("/ai/usage"),
  });

  const data = config.data;
  useEffect(() => {
    if (!data) return;
    setProvider(data.provider ?? "");
    setModel(data.model ?? "");
    setBaseUrl(data.baseUrl ?? "");
  }, [data]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["ai-config"] });
    void queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    void queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
  };

  const save = useMutation({
    mutationFn: () =>
      api.put<SaveResult>("/ai/config", {
        provider,
        model,
        apiKey,
        baseUrl: baseUrl.trim() || null,
      }),
    onSuccess: () => {
      setApiKey("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/ai/config"),
    onSuccess: () => {
      setApiKey("");
      refresh();
    },
  });
  const test = useMutation({
    mutationFn: () =>
      api.post<ConnectionResult>(
        "/ai/config/test",
        apiKey.trim() && provider && model
          ? {
              provider,
              model,
              apiKey: apiKey.trim(),
              baseUrl: baseUrl.trim() || null,
            }
          : {},
      ),
  });
  const setQuota = useMutation({
    mutationFn: () =>
      api.put("/ai/quota", {
        metric: quotaMetric,
        limit: quotaLimit.trim() === "" ? null : Number(quotaLimit.trim()),
      }),
    onSuccess: () => {
      setQuotaLimit("");
      void queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
    },
  });

  const providerLabel = useMemo(() => {
    const id = data?.provider ?? provider;
    return (
      providers.data?.providers.find((item) => item.id === id)?.label ?? id
    );
  }, [providers.data, data?.provider, provider]);

  if (config.isError || providers.isError) {
    return <QueryErrorState onRetry={() => void config.refetch()} />;
  }
  if (!data || !providers.data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-10 text-sm text-[#989898] sm:px-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading AI settings…
      </div>
    );
  }

  const canManage = data.canManage;
  const failed = save.isError
    ? save.error
    : remove.isError
      ? remove.error
      : test.isError
        ? test.error
        : setQuota.isError
          ? setQuota.error
          : null;
  const problem = apiProblem(failed);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <h1 className="sr-only">AI agent</h1>

      <Card className="rounded-xl border-[#242426] bg-[#0B0B0C]">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-[#F6F6F6]">
            <Bot className="h-4 w-4 text-[#ACFC15]" />
            Provider
          </CardTitle>
          <Badge
            variant="outline"
            className={
              data.activeSource === "byok"
                ? "border-[#34451D] text-[#ACFC15]"
                : data.activeSource === "platform"
                  ? "border-[#24404A] text-[#7FD8E8]"
                  : "border-[#4A2C22] text-[#F28B82]"
            }
          >
            Serving RCA: {SOURCE_LABEL[data.activeSource]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#242426] bg-[#151517] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[#F6F6F6]">
                <KeyRound className="h-3.5 w-3.5 text-[#ACFC15]" />
                Your own key (BYOK)
              </div>
              <p className="mt-2 text-xs leading-5 text-[#989898]">
                {data.configured
                  ? `Active · ${providerLabel ?? data.provider} · ${data.model} · key ending ${data.keyHint}`
                  : "No key stored for this organisation."}
              </p>
              {data.configured && (
                <p className="mt-2 text-[11px] text-[#6E6E70]">
                  {data.verifiedAt
                    ? `Verified ${new Date(data.verifiedAt).toLocaleString()}`
                    : data.lastErrorCode
                      ? `Last check failed: ${data.lastErrorCode}`
                      : "Not verified yet."}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-[#242426] bg-[#151517] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[#F6F6F6]">
                <Cloud className="h-3.5 w-3.5 text-[#7FD8E8]" />
                Platform default
              </div>
              <p className="mt-2 text-xs leading-5 text-[#989898]">
                {data.platform.configured
                  ? `Available · ${data.platform.provider} · ${data.platform.model}`
                  : "This server has no platform key configured."}
              </p>
              <p className="mt-2 text-[11px] text-[#6E6E70]">
                Used for RCA when no organisation key is saved. Tokens are
                billed to your quota.
              </p>
            </div>
          </div>

          {canManage ? (
            <div className="space-y-4 rounded-lg border border-[#242426] bg-[#111113] p-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPickerOpen(true)}
                    className="border-[#242426] bg-[#151517] text-[#F6F6F6] hover:bg-[#1C1C1F]"
                  >
                    {provider && model
                      ? `${providerLabel} · ${model}`
                      : "Choose provider and model"}
                  </Button>
                  <Input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="model id"
                    className="w-48 border-[#242426] bg-[#151517] text-[#F6F6F6]"
                  />
                </div>
                <p className="text-[11px] text-[#6E6E70]">
                  Pick from the catalogue, or type the exact model id your
                  account exposes.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>API key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={
                      data.configured
                        ? "Enter a new key to rotate"
                        : "Paste your API key"
                    }
                    className="border-[#242426] bg-[#151517] text-[#F6F6F6]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Base URL <span className="text-[#6E6E70]">(optional)</span>
                  </Label>
                  <Input
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="Leave blank to use the provider's own host"
                    className="border-[#242426] bg-[#151517] text-[#F6F6F6]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => save.mutate()}
                  disabled={
                    save.isPending ||
                    !provider ||
                    !model.trim() ||
                    !apiKey.trim()
                  }
                  className="bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90"
                >
                  {save.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  {save.isPending ? "Saving…" : "Save provider key"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => test.mutate()}
                  disabled={
                    test.isPending ||
                    !provider ||
                    !model.trim() ||
                    (!apiKey.trim() && !data.configured)
                  }
                  className="border-[#242426] text-[#F6F6F6]"
                >
                  {test.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {apiKey.trim() ? "Test this key" : "Test saved key"}
                </Button>
                {data.configured && (
                  <Button
                    variant="outline"
                    onClick={() => remove.mutate()}
                    disabled={remove.isPending}
                    className="border-[#4A2C22] text-[#F28B82]"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove key
                  </Button>
                )}
              </div>

              {save.data && save.data.warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-[#4A3A1C] bg-[#171307] p-3 text-xs text-[#E4A741]">
                  {save.data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-[#242426] bg-[#151517] p-4 text-xs text-[#989898]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#ACFC15]" />
                <span>
                  Keys are encrypted at rest and only ever sent to the provider
                  you picked, or to a base URL you type yourself. Nothing is
                  stored on our side beyond the last four characters.
                </span>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-[#242426] bg-[#151517] p-4 text-xs text-[#989898]">
              Only owners and admins can change AI settings. You can see the
              active provider and spend.
            </p>
          )}

          {test.data && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                test.data.ok
                  ? "border-[#34451D] bg-[#11170D] text-[#ACFC15]"
                  : "border-[#4A2C22] bg-[#17100E] text-[#F28B82]"
              }`}
            >
              {test.data.ok ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
              )}
              <span>
                {test.data.detail}
                {!test.data.checkable &&
                  " The key is saved as-is; this provider has no queryable model list."}
              </span>
            </div>
          )}

          {failed && (
            <div className="space-y-1 rounded-lg border border-[#4A2C22] bg-[#17100E] px-3 py-2 text-xs text-[#F28B82]">
              <p>
                {problem.detail ?? problem.title ?? (failed as Error).message}
              </p>
              {problem.hint && <p className="text-[#989898]">{problem.hint}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[#242426] bg-[#0B0B0C]">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-[#F6F6F6]">
            <Database className="h-4 w-4 text-[#ACFC15]" />
            Usage this month
          </CardTitle>
          <Badge variant="outline" className="border-[#242426] text-[#989898]">
            {usage.data?.quotaEnforced ? "Quota enforced" : "Metered only"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat
              label="Platform-funded tokens"
              value={formatTokens(usage.data?.tokens.platform ?? 0)}
              limit={usage.data?.limits.aiTokens}
            />
            <Stat
              label="Your own tokens (BYOK)"
              value={formatTokens(usage.data?.tokens.byok ?? 0)}
            />
            <Stat
              label="RCA runs"
              value={String(usage.data?.invocations ?? 0)}
              limit={usage.data?.limits.rcaInvocations}
            />
            <Stat
              label="Platform AI cost (est.)"
              value={formatUsd(usage.data?.costUsd?.platform ?? 0)}
            />
            <Stat
              label="BYOK AI cost (est.)"
              value={formatUsd(usage.data?.costUsd?.byok ?? 0)}
            />
          </div>
          {usage.data && usage.data.runs.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px] text-[#6E6E70]">
              {usage.data.runs.map((run) => (
                <span
                  key={`${run.credentialSource ?? "unknown"}-${run.status}`}
                  className="rounded-md border border-[#242426] bg-[#151517] px-2 py-1"
                >
                  {run.credentialSource ?? "unknown"} · {run.status} ·{" "}
                  {run.runs} runs · {formatTokens(run.tokens)} tokens ·{" "}
                  {formatUsd(run.costUsd ?? 0)}
                </span>
              ))}
            </div>
          )}
          {canManage && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#242426] bg-[#111113] p-4">
              <div className="space-y-2">
                <Label>Quota to buy</Label>
                <Select
                  value={quotaMetric}
                  onValueChange={(value) =>
                    setQuotaMetric(
                      value === "rca_invocations"
                        ? "rca_invocations"
                        : "ai_tokens",
                    )
                  }
                >
                  <SelectTrigger className="w-44 border-[#242426] bg-[#151517] text-[#F6F6F6]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
                    <SelectItem value="ai_tokens">AI tokens</SelectItem>
                    <SelectItem value="rca_invocations">RCA runs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly limit</Label>
                <Input
                  value={quotaLimit}
                  onChange={(event) => setQuotaLimit(event.target.value)}
                  placeholder="Leave blank for unlimited"
                  inputMode="numeric"
                  className="w-44 border-[#242426] bg-[#151517] text-[#F6F6F6]"
                />
              </div>
              <Button
                onClick={() => setQuota.mutate()}
                disabled={setQuota.isPending}
                className="bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90"
              >
                {setQuota.isPending ? "Saving…" : "Set quota"}
              </Button>
              <p className="w-full text-[11px] text-[#6E6E70]">
                Buying quota lifts the cap for platform-funded runs only; your
                own keys are never capped.
              </p>
            </div>
          )}
          {usage.isError && (
            <p className="text-xs text-[#F28B82]">
              {(usage.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>

      <ModelPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(providerId, modelId) => {
          setProvider(providerId);
          setModel(modelId);
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  limit,
}: {
  label: string;
  value: string;
  limit?: number | null;
}) {
  return (
    <div className="rounded-lg border border-[#242426] bg-[#151517] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[#6E6E70]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[#F6F6F6]">
        {value}
        {limit !== undefined && limit !== null && (
          <span className="ml-1 text-xs font-normal text-[#6E6E70]">
            / {formatTokens(limit)}
          </span>
        )}
      </p>
    </div>
  );
}
