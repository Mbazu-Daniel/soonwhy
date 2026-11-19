import { Injectable, Logger } from "@nestjs/common";
import { getProviderConfig, modelSupportsStructuredOutput, PROVIDER_REGISTRY } from "@mastra/core/llm";
import { z } from "zod";
import { aiEndpointUnknown } from "../domain/ai.errors";
import { CUSTOM_PROVIDER_ID, CUSTOM_PROVIDER_LABEL } from "../domain/custom-provider.constants";
import modelsSnapshot from "../models-snapshot.json";
import type { CatalogProvider, CatalogModel, ModelPricing } from "../domain/llm-catalog.service.types";

const MODELS_DEV_URL = "https://models.dev/api.json";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const RETRY_BACKOFF_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

const ModelsDevModelSchema = z
  .object({
    name: z.string().nullish(),
    description: z.string().nullish(),
    cost: z
      .object({
        input: z.number().nullish(),
        output: z.number().nullish(),
      })
      .nullish(),
    limit: z
      .object({
        context: z.number().nullish(),
        output: z.number().nullish(),
      })
      .nullish(),
    structured_output: z.boolean().nullish(),
    status: z.string().nullish(),
  })
  .passthrough();

const ModelsDevProviderSchema = z
  .object({
    name: z.string().nullish(),
    api: z.string().nullish(),
    models: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const ModelsDevDocumentSchema = z.record(z.string(), z.unknown());

interface ModelMetadata {
  label: string;
  description: string | null;
  contextTokens: number | null;
  outputTokens: number | null;
  inputCostUsdPerMillion: number | null;
  outputCostUsdPerMillion: number | null;
  structuredOutput: boolean;
  deprecated: boolean;
}

interface ProviderMetadata {
  apiUrl: string | null;
  models: Map<string, ModelMetadata>;
}

type MetadataIndex = Map<string, ProviderMetadata>;

function hostnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

@Injectable()
export class LlmCatalog {
  private static readonly logger = new Logger(LlmCatalog.name);
  private readonly ttlMs =
    Number(process.env.SOONWHY_AI_CATALOG_TTL_MS) || DEFAULT_TTL_MS;
  private metadata: MetadataIndex | null = null;
  private fromSnapshot = false;
  private fetchedAt = 0;
  private pending: Promise<MetadataIndex> | null = null;

  isKnownProvider(providerId: string): boolean {
    return providerId === CUSTOM_PROVIDER_ID || getProviderConfig(providerId) !== undefined;
  }

  providers(): CatalogProvider[] {
    const registered = Object.keys(PROVIDER_REGISTRY)
      .map((id) => this.provider(id))
      .filter((provider): provider is CatalogProvider => provider !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
    return [...registered, this.provider(CUSTOM_PROVIDER_ID)!];
  }

  provider(providerId: string): CatalogProvider | null {
    if (providerId === CUSTOM_PROVIDER_ID) {
      return {
        id: CUSTOM_PROVIDER_ID,
        label: CUSTOM_PROVIDER_LABEL,
        baseUrl: null,
        docUrl: null,
        modelCount: 0,
        rcaSafeModelCount: null,
      };
    }
    const config = getProviderConfig(providerId);
    if (!config) return null;

    const enriched = this.ensureMetadata().get(providerId);
    return {
      id: providerId,
      label: config.name || providerId,
      baseUrl: this.baseUrlFor(providerId),
      docUrl: config.docUrl ?? null,
      modelCount: config.models.length,
      rcaSafeModelCount: enriched ? this.rcaSafeCount(enriched, config.models) : null,
    };
  }

  private rcaSafeCount(enriched: ProviderMetadata, modelIds: string[]): number {
    return modelIds.filter((modelId) => enriched.models.get(modelId)?.structuredOutput === true).length;
  }

  baseUrlFor(providerId: string): string | null {
    return getProviderConfig(providerId)?.url ?? null;
  }

  endpointFor(providerId: string, baseUrl: string | null): string | null {
    if (baseUrl) return baseUrl;
    if (providerId === CUSTOM_PROVIDER_ID) throw aiEndpointUnknown(providerId);
    const documented = this.baseUrlFor(providerId);
    if (documented) return documented;
    if (this.isKnownProvider(providerId)) return null;
    throw aiEndpointUnknown(providerId);
  }

  allowedHostnamesFor(providerId: string): string[] {
    const endpoints = [
      this.baseUrlFor(providerId),
      this.ensureMetadata().get(providerId)?.apiUrl ?? null,
    ];
    const hostnames = new Set(
      endpoints
        .map((url) => hostnameOf(url ?? undefined))
        .filter((host): host is string => host !== null),
    );
    return [...hostnames];
  }

  supportsStructuredOutput(providerId: string, modelId: string): boolean {
    return (
      modelSupportsStructuredOutput(`${providerId}/${modelId}`) === true ||
      this.ensureMetadata().get(providerId)?.models.get(modelId)?.structuredOutput ===
        true
    );
  }

  pricing(providerId: string, modelId: string): ModelPricing | null {
    const entry = this.ensureMetadata().get(providerId)?.models.get(modelId);
    if (!entry) return null;
    const { inputCostUsdPerMillion: input, outputCostUsdPerMillion: output } =
      entry;
    if (input === null || output === null) return null;
    return { inputUsdPerMillion: input, outputUsdPerMillion: output };
  }

  async models(providerId: string): Promise<CatalogModel[]> {
    const config = getProviderConfig(providerId);
    if (!config) return [];

    await this.loadMetadata();
    const index = this.ensureMetadata().get(providerId)?.models;
    const deprecated = new Set(config.deprecatedModels ?? []);

    return config.models.map((modelId) => {
      const entry = index?.get(modelId);
      return {
        id: modelId,
        label: entry?.label ?? modelId,
        description: entry?.description ?? null,
        contextTokens: entry?.contextTokens ?? null,
        outputTokens: entry?.outputTokens ?? null,
        inputCostUsdPerMillion: entry?.inputCostUsdPerMillion ?? null,
        outputCostUsdPerMillion: entry?.outputCostUsdPerMillion ?? null,
        supportsStructuredOutput:
          entry?.structuredOutput ??
          modelSupportsStructuredOutput(`${providerId}/${modelId}`) ??
          false,
        deprecated: deprecated.has(modelId) || entry?.deprecated === true,
      };
    });
  }

  private ensureMetadata(): MetadataIndex {
    if (!this.metadata) {
      this.metadata = indexFromDocument(modelsSnapshot);
      this.fromSnapshot = true;
    }
    return this.metadata;
  }

  private loadMetadata(): Promise<MetadataIndex> {
    const current = this.ensureMetadata();
    const age = Date.now() - this.fetchedAt;
    const maxAge = this.fromSnapshot ? RETRY_BACKOFF_MS : this.ttlMs;

    if (this.fetchedAt > 0 && age <= maxAge) return Promise.resolve(current);
    if (this.pending) return this.pending;

    this.pending = this.fetchMetadata()
      .then((index) => {
        this.metadata = index;
        this.fromSnapshot = false;
        return index;
      })
      .catch((error: unknown) => {
        LlmCatalog.logger.warn(
          `models.dev catalog unavailable, using ${
            this.fromSnapshot ? "the bundled snapshot" : "the last fetched copy"
          }: ${error instanceof Error ? error.message : "unknown error"}`,
        );
        return this.metadata ?? current;
      })
      .finally(() => {
        this.fetchedAt = Date.now();
        this.pending = null;
      });

    return this.pending;
  }

  private async fetchMetadata(): Promise<MetadataIndex> {
    const response = await fetch(MODELS_DEV_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`models.dev responded with ${response.status}`);
    }

    return indexFromDocument(await response.json());
  }
}

function indexFromDocument(raw: unknown): MetadataIndex {
  const document = ModelsDevDocumentSchema.parse(raw);
  const index: MetadataIndex = new Map();

  for (const [providerId, providerValue] of Object.entries(document)) {
    const provider = ModelsDevProviderSchema.safeParse(providerValue);
    if (!provider.success) continue;

    const models = new Map<string, ModelMetadata>();
    for (const [modelId, modelValue] of Object.entries(
      provider.data.models ?? {},
    )) {
      const model = ModelsDevModelSchema.safeParse(modelValue);
      if (!model.success) continue;
      models.set(modelId, {
        label: model.data.name ?? modelId,
        description: model.data.description ?? null,
        contextTokens: model.data.limit?.context ?? null,
        outputTokens: model.data.limit?.output ?? null,
        inputCostUsdPerMillion: model.data.cost?.input ?? null,
        outputCostUsdPerMillion: model.data.cost?.output ?? null,
        structuredOutput: model.data.structured_output ?? false,
        deprecated: model.data.status === "deprecated",
      });
    }
    index.set(providerId, {
      apiUrl: provider.data.api ?? null,
      models,
    });
  }

  return index;
}
