import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api, apiProblem } from "~/lib/api";
import { AI_CATALOG_KEY, CUSTOM_PROVIDER_ID } from "~/lib/ai-providers.constants";
import type {
  AiCredential,
  CatalogProvider,
  LiveModels,
  ProviderFormValues,
} from "~/lib/ai-providers.types";

const EMPTY: ProviderFormValues = {
  name: "",
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  isDefault: false,
};

const FIELD =
  "w-full rounded-md border border-[#242426] bg-[#151517] px-3 py-2 text-sm text-[#F6F6F6] outline-none focus:border-[#ACFC15]/60";

function initial(current: AiCredential | null): ProviderFormValues {
  if (!current) return EMPTY;
  return {
    name: current.name,
    provider: current.provider,
    apiKey: "",
    baseUrl: current.baseUrl ?? "",
    model: current.model,
    isDefault: current.isDefault,
  };
}

export function ProviderModal({
  open,
  onOpenChange,
  current,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: AiCredential | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProviderFormValues>(EMPTY);
  const [models, setModels] = useState<string[]>([]);
  const isEdit = current !== null;
  const isCustom = form.provider === CUSTOM_PROVIDER_ID;

  useEffect(() => {
    if (!open) return;
    setForm(initial(current));
    setModels([]);
  }, [open, current]);

  const catalog = useQuery({
    queryKey: AI_CATALOG_KEY,
    queryFn: () => api.get<{ providers: CatalogProvider[] }>("/ai/providers"),
    staleTime: 5 * 60_000,
  });
  const providers = catalog.data?.providers ?? [];
  const selected = providers.find((item) => item.id === form.provider);
  const shownUrl = isCustom ? form.baseUrl : (selected?.baseUrl ?? "");

  const set = <K extends keyof ProviderFormValues>(key: K, value: ProviderFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pickProvider = (id: string) => {
    setForm((prev) => ({
      ...prev,
      provider: id,
      baseUrl: "",
      model: "",
      name: prev.name || providers.find((item) => item.id === id)?.label || "",
    }));
    setModels([]);
  };

  const load = useMutation({
    mutationFn: () =>
      api.post<LiveModels>(
        "/ai/models",
        form.apiKey.trim() || !current
          ? { provider: form.provider, apiKey: form.apiKey.trim(), ...(isCustom ? { baseUrl: form.baseUrl.trim() } : {}) }
          : { credentialId: current.id },
      ),
    onSuccess: (result) => {
      setModels(result.models);
      if (!form.model && result.models[0]) set("model", result.models[0]);
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const baseUrl = isCustom ? form.baseUrl.trim() : null;
      if (current) {
        return api.patch(`/ai/credentials/${current.id}`, {
          name: form.name.trim(),
          model: form.model.trim(),
          ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
          ...(isCustom ? { baseUrl } : {}),
          isDefault: form.isDefault,
        });
      }
      return api.post("/ai/credentials", {
        name: form.name.trim() || undefined,
        provider: form.provider,
        model: form.model.trim(),
        apiKey: form.apiKey.trim(),
        ...(baseUrl ? { baseUrl } : {}),
        isDefault: form.isDefault,
      });
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
  });

  const canLoad = !!form.provider && (!!form.apiKey.trim() || isEdit) && (!isCustom || !!form.baseUrl.trim());
  const canSave =
    !!form.provider && !!form.model.trim() && (!!form.apiKey.trim() || isEdit) && (!isCustom || !!form.baseUrl.trim());
  const failure = apiProblem(save.isError ? save.error : load.isError ? load.error : null);
  const failureText = failure.detail ?? failure.title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
        <DialogHeader>
          <DialogTitle className="text-[#F6F6F6]">{isEdit ? "Edit provider" : "Add provider"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-name">Name</Label>
            <Input
              id="provider-name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Fast lane"
              className="border-[#242426] bg-[#151517]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-kind">Provider</Label>
            <select
              id="provider-kind"
              value={form.provider}
              disabled={isEdit}
              onChange={(event) => pickProvider(event.target.value)}
              className={FIELD}
            >
              <option value="">Select a provider…</option>
              {providers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-key">API key</Label>
            <Input
              id="provider-key"
              type="password"
              autoComplete="off"
              value={form.apiKey}
              onChange={(event) => set("apiKey", event.target.value)}
              placeholder={isEdit ? `Stored · ${current.keyHint} (leave blank to keep)` : "Paste your key"}
              className="border-[#242426] bg-[#151517]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-url">Base URL</Label>
            <Input
              id="provider-url"
              value={shownUrl}
              disabled={!isCustom}
              onChange={(event) => set("baseUrl", event.target.value)}
              placeholder={isCustom ? "https://llm.example.com/v1" : "Set by the provider"}
              className="border-[#242426] bg-[#151517] disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-model">Model</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canLoad || load.isPending}
                onClick={() => load.mutate()}
                className="h-7 border-[#242426] text-xs text-[#F6F6F6]"
              >
                {load.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Load models
              </Button>
            </div>
            <input
              id="provider-model"
              list="provider-model-options"
              value={form.model}
              onChange={(event) => set("model", event.target.value)}
              placeholder={models.length ? "Pick or type a model" : "Type a model, or load the list"}
              className={FIELD}
            />
            <datalist id="provider-model-options">
              {models.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
            {models.length > 0 && (
              <p className="text-[11px] text-[#6E6E70]">{models.length} models available — click the field to switch.</p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              role="switch"
              checked={form.isDefault}
              disabled={current?.isDefault === true}
              onChange={(event) => set("isDefault", event.target.checked)}
              className="h-4 w-4 accent-[#ACFC15]"
            />
            <span>Use as the default for this workspace</span>
          </label>

          {failureText && (
            <p className="flex items-start gap-2 text-xs text-[#F28B82]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {failureText}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#242426] text-[#F6F6F6]">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSave || save.isPending}
              onClick={() => save.mutate()}
              className="bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90"
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
