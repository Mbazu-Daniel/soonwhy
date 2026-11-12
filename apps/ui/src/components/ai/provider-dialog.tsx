import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  ModelPicker,
  type CatalogProvider,
} from "~/components/ai/model-picker";
import { api, apiProblem } from "~/lib/api";

export interface EditableProvider {
  configured: boolean;
  provider?: string;
  model?: string;
  keyHint?: string;
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

export function ProviderDialog({
  open,
  onOpenChange,
  current,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: EditableProvider;
  onSaved: () => void;
}) {
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const isEdit = current.configured;

  useEffect(() => {
    if (!open) return;
    setProvider(current.provider ?? "");
    setModel(current.model ?? "");
    setApiKey("");
    setWarnings([]);
  }, [open, current.provider, current.model]);

  const catalog = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () =>
      api.get<{ providers: CatalogProvider[] }>("/ai/providers"),
    staleTime: 5 * 60_000,
  });
  const providerLabel = useMemo(
    () =>
      catalog.data?.providers.find((item) => item.id === provider)?.label ??
      provider,
    [catalog.data, provider],
  );

  const save = useMutation({
    mutationFn: () =>
      api.put<SaveResult>("/ai/config", {
        provider,
        model: model.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      }),
    onSuccess: (result) => {
      setApiKey("");
      onSaved();
      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
        return;
      }
      onOpenChange(false);
    },
  });
  const test = useMutation({
    mutationFn: () =>
      api.post<ConnectionResult>(
        "/ai/config/test",
        apiKey.trim() && provider && model.trim()
          ? {
              provider,
              model: model.trim(),
              apiKey: apiKey.trim(),
            }
          : {},
      ),
  });

  const failed = save.isError
    ? save.error
    : test.isError
      ? test.error
      : null;
  const problem = apiProblem(failed);
  const canSave =
    !!provider && !!model.trim() && (!!apiKey.trim() || isEdit);
  const canTest =
    !!provider && !!model.trim() && (!!apiKey.trim() || isEdit);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
          <DialogHeader>
            <DialogTitle className="text-[#F6F6F6]">
              {isEdit ? "Edit provider" : "Add provider"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPickerOpen(true)}
                className="w-full justify-between border-[#242426] bg-[#151517] text-left text-[#F6F6F6] hover:bg-[#1C1C1F]"
              >
                <span className={provider ? "" : "text-[#6E6E70]"}>
                  {provider ? providerLabel : "Choose a provider"}
                </span>
                <Search className="h-4 w-4 shrink-0 text-[#6E6E70]" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="openai/gpt-oss-120b"
                autoComplete="off"
                className="border-[#242426] bg-[#151517] text-[#F6F6F6]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-key">API key</Label>
              <Input
                id="ai-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  isEdit
                    ? `Stored · ${current.keyHint ?? ""} · leave blank to keep`
                    : "Paste your API key"
                }
                autoComplete="off"
                className="border-[#242426] bg-[#151517] text-[#F6F6F6]"
              />
            </div>

            {warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-[#4A3A1C] bg-[#171307] p-3 text-xs text-[#E4A741]">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
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

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => test.mutate()}
                disabled={test.isPending || !canTest}
                className="border-[#242426] text-[#F6F6F6]"
              >
                {test.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {apiKey.trim() ? "Test key" : "Test stored key"}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="text-[#989898]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => save.mutate()}
                  disabled={!canSave || save.isPending}
                  className="bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90"
                >
                  {save.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ModelPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(providerId, modelId) => {
          setProvider(providerId);
          setModel(modelId);
        }}
      />
    </>
  );
}
