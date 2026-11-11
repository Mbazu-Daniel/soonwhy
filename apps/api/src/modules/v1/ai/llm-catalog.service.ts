import { Injectable, Logger } from "@nestjs/common";
import {
  getProviderConfig,
  modelSupportsStructuredOutput,
  PROVIDER_REGISTRY,
} from "@mastra/core/llm";
import { z } from "zod";
import { aiEndpointUnknown } from "./ai.errors";

const MODELS_DEV_URL = "https://models.dev/api.json";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const RETRY_BACKOFF_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * models.dev answers with explicit `null`s for fields it has not filled in, so
 * every optional field has to accept null as well as absence; `optional()` alone
 * rejects the document and silently drops the whole enrichment.
 */
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
    /** Validated when it is used as a host, because some entries are not URLs. */
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

export interface ModelPricing {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
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
  private fetchedAt = 0;
  private pending: Promise<MetadataIndex | null> | null = null;

  isKnownProvider(providerId: string): boolean {
    return getProviderConfig(providerId) !== undefined;
  }

  providers(): CatalogProvider[] {
    return Object.keys(PROVIDER_REGISTRY)
      .map((id) => this.provider(id))
      .filter((provider): provider is CatalogProvider => provider !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  provider(providerId: string): CatalogProvider | null {
    const config = getProviderConfig(providerId);
    if (!config) return null;

    const enriched = this.metadata?.get(providerId);
    return {
      id: providerId,
      label: config.name || providerId,
      baseUrl: this.baseUrlFor(providerId),
      docUrl: config.docUrl ?? null,
      modelCount: config.models.length,
      rcaSafeModelCount: enriched
        ? config.models.filter((modelId) =>
            this.supportsStructuredOutput(providerId, modelId),
          ).length
        : null,
    };
  }

  /**
   * The endpoint this provider's credentials are sent to. `null` means Mastra
   * resolves the host from the provider's own SDK, which is the only safe
   * alternative to a saved URL: models.dev documents hosts for many providers,
   * but a documented host is not necessarily one that speaks the request shape
   * Mastra would send.
   */
  baseUrlFor(providerId: string): string | null {
    return getProviderConfig(providerId)?.url ?? null;
  }

  /**
   * The endpoint a provider's key may be sent to: the URL the organisation
   * chose, else the host this provider is registered with, else `null` for the
   * provider's own SDK resolution. Anything else fails rather than shipping a
   * secret to a guessed address.
   */
  endpointFor(providerId: string, baseUrl: string | null): string | null {
    if (baseUrl) return baseUrl;
    const documented = this.baseUrlFor(providerId);
    if (documented) return documented;
    if (this.isKnownProvider(providerId)) return null;
    throw aiEndpointUnknown(providerId);
  }

  /**
   * Hostnames this provider's key may legitimately be sent to: the resolved
   * endpoint plus the API host models.dev documents for the provider. Empty
   * when nothing documents a host, which is what makes a native-SDK provider
   * unbotherable over plain HTTP.
   */
  allowedHostnamesFor(providerId: string): string[] {
    const endpoints = [
      this.baseUrlFor(providerId),
      this.metadata?.get(providerId)?.apiUrl ?? null,
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
      this.metadata?.get(providerId)?.models.get(modelId)?.structuredOutput ===
        true
    );
  }

  pricing(providerId: string, modelId: string): ModelPricing | null {
    const entry = this.metadata?.get(providerId)?.models.get(modelId);
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
    const index = this.metadata?.get(providerId)?.models;
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

  private loadMetadata(): Promise<MetadataIndex | null> {
    const now = Date.now();
    const age = now - this.fetchedAt;

    if (this.metadata && age <= this.ttlMs)
      return Promise.resolve(this.metadata);
    if (
      this.metadata === null &&
      this.fetchedAt > 0 &&
      age <= RETRY_BACKOFF_MS
    ) {
      return Promise.resolve(null);
    }
    if (this.pending) return this.pending;

    this.pending = this.fetchMetadata()
      .then((index) => {
        this.metadata = index;
        this.fetchedAt = Date.now();
        return index;
      })
      .catch((error: unknown) => {
        // Enrichment only: the bundled registry keeps AI usable when models.dev is down.
        this.metadata = null;
        this.fetchedAt = Date.now();
        LlmCatalog.logger.warn(
          `models.dev catalog unavailable, using bundled provider registry: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        return null;
      })
      .finally(() => {
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

    const document = ModelsDevDocumentSchema.parse(await response.json());
    const index: MetadataIndex = new Map();

    // models.dev is a community catalogue: one malformed provider or model must
    // not cost the enrichment for every other one.
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
}
