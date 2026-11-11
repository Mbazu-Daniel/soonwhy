import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { api } from "~/lib/api";

export interface CatalogProvider {
  id: string;
  label: string;
  baseUrl: string | null;
  docUrl: string | null;
  modelCount: number;
  rcaSafeModelCount: number | null;
}

export interface CatalogModel {
  id: string;
  label: string;
  description: string | null;
  contextTokens: number | null;
  outputTokens: number | null;
  inputCostUsdPerMillion: number | null;
  outputCostUsdPerMillion: number | null;
  supportsStructuredOutput: boolean;
  deprecated: boolean;
}

function compactTokens(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function price(model: CatalogModel): string | null {
  const { inputCostUsdPerMillion: input, outputCostUsdPerMillion: output } =
    model;
  if (input === null || output === null) return null;
  return `$${input}/$${output} per M`;
}

function matches(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

export function ModelPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (providerId: string, modelId: string) => void;
}) {
  const [providerId, setProviderId] = useState<string | null>(null);
  const [providerQuery, setProviderQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rows = useRef(new Map<number, HTMLButtonElement>());

  const { data: providerData } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.get<{ providers: CatalogProvider[] }>("/ai/providers"),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const { data: modelData, isFetching: modelsLoading } = useQuery({
    queryKey: ["ai-provider-models", providerId],
    queryFn: () =>
      api.get<{ models: CatalogModel[] }>(
        `/ai/providers/${encodeURIComponent(providerId ?? "")}/models`,
      ),
    enabled: open && providerId !== null,
    staleTime: 10 * 60_000,
  });

  const providers = useMemo(() => {
    const query = providerQuery.trim();
    const all = providerData?.providers ?? [];
    return query
      ? all.filter((item) => matches(`${item.label} ${item.id}`, query))
      : all;
  }, [providerData, providerQuery]);

  const models = useMemo(() => {
    const query = modelQuery.trim();
    const all = (modelData?.models ?? []).filter((item) => !item.deprecated);
    return query
      ? all.filter((item) =>
          matches(`${item.label} ${item.id} ${item.description ?? ""}`, query),
        )
      : all;
  }, [modelData, modelQuery]);

  const choosingModel = providerId !== null;
  const options = choosingModel ? models.length : providers.length;

  useEffect(() => {
    if (!open) {
      setProviderId(null);
      setProviderQuery("");
      setModelQuery("");
    }
    setHighlight(0);
  }, [open, providerId, providerQuery, modelQuery]);

  useEffect(() => {
    rows.current.get(highlight)?.scrollIntoView({ block: "nearest" });
  }, [highlight, options]);

  function move(delta: number) {
    setHighlight((current) => {
      if (options === 0) return 0;
      const next = current + delta;
      return next < 0 ? options - 1 : next % options;
    });
  }

  const chosenProvider = providerData?.providers.find(
    (item) => item.id === providerId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
        <DialogHeader>
          <DialogTitle className="text-[#F6F6F6]">
            {choosingModel
              ? (chosenProvider?.label ?? "Choose a model")
              : "Choose a provider"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E6E70]" />
            <Input
              autoFocus
              value={choosingModel ? modelQuery : providerQuery}
              onChange={(event) =>
                choosingModel
                  ? setModelQuery(event.target.value)
                  : setProviderQuery(event.target.value)
              }
              placeholder={
                choosingModel ? "Search models" : "Search 200+ providers"
              }
              className="border-[#242426] bg-[#151517] pl-9 text-[#F6F6F6]"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  move(-1);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (choosingModel) {
                    const model = models[highlight];
                    if (model && providerId) {
                      onSelect(providerId, model.id);
                      onOpenChange(false);
                    }
                  } else {
                    const provider = providers[highlight];
                    if (provider) setProviderId(provider.id);
                  }
                } else if (
                  event.key === "Backspace" &&
                  choosingModel &&
                  modelQuery === ""
                ) {
                  setProviderId(null);
                }
              }}
            />
          </div>

          {choosingModel && modelsLoading && models.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#989898]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading models…
            </div>
          ) : options === 0 ? (
            <p className="py-8 text-center text-xs text-[#989898]">
              No matches.
            </p>
          ) : (
            <div
              role="listbox"
              className="max-h-80 overflow-y-auto rounded-lg border border-[#242426] bg-[#111113] p-1"
            >
              {choosingModel
                ? models.map((model, index) => (
                    <button
                      key={model.id}
                      ref={(node) => {
                        if (node) rows.current.set(index, node);
                        else rows.current.delete(index);
                      }}
                      type="button"
                      role="option"
                      aria-selected={index === highlight}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => {
                        if (providerId) onSelect(providerId, model.id);
                        onOpenChange(false);
                      }}
                      className={`flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        index === highlight
                          ? "bg-[#ACFC15]/10 text-[#F6F6F6]"
                          : "text-[#989898]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#F6F6F6]">
                          {model.label}
                        </span>
                        <span className="block truncate text-[11px] text-[#6E6E70]">
                          {model.id}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                        {model.contextTokens !== null && (
                          <span className="text-[#989898]">
                            {compactTokens(model.contextTokens)} ctx
                          </span>
                        )}
                        {price(model) && (
                          <span className="text-[#6E6E70]">{price(model)}</span>
                        )}
                        {!model.supportsStructuredOutput && (
                          <span className="text-[#E4A741]">not RCA-safe</span>
                        )}
                      </span>
                    </button>
                  ))
                : providers.map((provider, index) => (
                    <button
                      key={provider.id}
                      ref={(node) => {
                        if (node) rows.current.set(index, node);
                        else rows.current.delete(index);
                      }}
                      type="button"
                      role="option"
                      aria-selected={index === highlight}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => setProviderId(provider.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        index === highlight
                          ? "bg-[#ACFC15]/10 text-[#F6F6F6]"
                          : "text-[#989898]"
                      }`}
                    >
                      <span className="truncate font-medium">
                        {provider.label}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[11px] text-[#6E6E70]">
                        {provider.rcaSafeModelCount !== null && (
                          <span className="flex items-center gap-1 text-[#ACFC15]">
                            <Check className="h-3 w-3" />
                            {provider.rcaSafeModelCount}
                          </span>
                        )}
                        {provider.modelCount}
                      </span>
                    </button>
                  ))}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-[#6E6E70]">
            {choosingModel ? (
              <button
                type="button"
                onClick={() => setProviderId(null)}
                className="flex items-center gap-1 hover:text-[#F6F6F6]"
              >
                <ArrowLeft className="h-3 w-3" />
                All providers
              </button>
            ) : (
              <span>Provider, then model</span>
            )}
            <span>↑↓ move · Enter {choosingModel ? "select" : "continue"}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
