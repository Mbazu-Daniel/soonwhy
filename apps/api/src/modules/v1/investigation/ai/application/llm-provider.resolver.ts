import { Inject, Injectable, Logger, Optional, OnModuleInit, OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";
import { AiRepository } from "../infrastructure/ai.repository";
import { CredentialCipher } from "../domain/credential-cipher";
import { LlmCatalog } from "./llm-catalog.service";
import { type ModelPricing } from "../domain/llm-catalog.service.types";
import { buildProviderConfig, readLlmTuning } from "./llm-provider.config";
import { type LlmTuning } from "../domain/llm-provider.config.types";
import { aiCredentialNotFound, aiCredentialUnreadable, aiNotConfigured, CredentialDecryptError } from "../domain/ai.errors";
import { MastraRcaProvider } from "../../../detection/detections/infrastructure/rca.provider";
import type { ResolvedLlmModel, ResolvedLlmHandle, LlmCredentialSummary } from "./llm-provider.resolver.types";

type CredentialRow = Awaited<ReturnType<AiRepository["find"]>>;
type ByokCredential = NonNullable<CredentialRow>;

interface CacheEntry {
  expiresAt: number;
  request: Promise<ResolvedLlmModel>;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_ORGS = 256;
const KEY_SEPARATOR = "\u0000";
const INVALIDATE_CHANNEL = "soonwhy:llm-credential-invalidate";

@Injectable()
export class LlmProviderResolver implements OnModuleInit, OnApplicationShutdown {
  private static readonly logger = new Logger(LlmProviderResolver.name);
  private readonly cache = new Map<string, CacheEntry>();
  private subscriber?: Redis;
  private readonly ttlMs =
    Number(process.env.SOONWHY_AI_CREDENTIAL_CACHE_TTL_MS) ||
    DEFAULT_CACHE_TTL_MS;
  private readonly tuning: LlmTuning;

  constructor(
    @Inject(AiRepository) private readonly repository: Pick<
      AiRepository,
      "get" | "find"
    >,
    @Inject(CredentialCipher) private readonly cipher: CredentialCipher,
    @Inject(LlmCatalog) private readonly catalog: LlmCatalog,
    @Optional() @Inject(Redis) private readonly redis?: Redis,
  ) {
    this.tuning = readLlmTuning();
  }

  async onModuleInit(): Promise<void> {
    if (!this.redis) return;
    try {
      this.subscriber = this.redis.duplicate();
      this.subscriber.on("error", (error: Error) => {
        LlmProviderResolver.logger.warn(
          `LLM credential invalidation subscriber error: ${error.message}`,
        );
      });
      await this.subscriber.connect();
      await this.subscriber.subscribe(INVALIDATE_CHANNEL);
      this.subscriber.on("message", (_channel: string, orgId: string) => {
        this.evictLocal(orgId);
      });
    } catch (error) {
      this.subscriber = undefined;
      LlmProviderResolver.logger.warn(
        `LLM credential invalidation broadcast unavailable (cache TTL still applies): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }

  pricingFor(providerId: string, modelId: string): ModelPricing | null {
    return this.catalog.pricing(providerId, modelId);
  }

  async resolveForRca(orgId: string, credentialId?: string): Promise<ResolvedLlmHandle> {
    const model = await this.resolve(orgId, credentialId);
    const pricing = this.catalog.pricing(model.providerId, model.model);
    return {
      provider: new MastraRcaProvider(
        buildProviderConfig(model, this.tuning, pricing ?? undefined),
      ),
      credential: {
        source: model.source,
        providerId: model.providerId,
        model: model.model,
        credentialId: model.credentialId,
      },
      promptVersion: this.tuning.promptVersion,
    };
  }

  async describe(orgId: string): Promise<LlmCredentialSummary> {
    const row = await this.repository.get(orgId);
    if (isUsableByok(row)) {
      return { source: "byok", provider: row.provider, model: row.model };
    }
    return { source: "none", provider: null, model: null };
  }

  invalidate(orgId: string): void {
    this.evictLocal(orgId);
    if (!this.redis) return;
    this.redis
      .publish(INVALIDATE_CHANNEL, orgId)
      .catch((error: Error) => {
        LlmProviderResolver.logger.warn(
          `Failed to broadcast LLM credential invalidation for org ${orgId}: ${error.message}`,
        );
      });
  }

  private evictLocal(orgId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${orgId}${KEY_SEPARATOR}`)) this.cache.delete(key);
    }
  }

  async resolve(orgId: string, credentialId?: string): Promise<ResolvedLlmModel> {
    const key = `${orgId}${KEY_SEPARATOR}${credentialId ?? ""}`;
    const cached = this.cache.get(key);
    if (cached && (cached.expiresAt === 0 || cached.expiresAt > Date.now())) {
      return cached.request;
    }

    const entry: CacheEntry = { expiresAt: 0, request: this.load(orgId, credentialId) };
    entry.request = entry.request.then((model) => {
      entry.expiresAt = Date.now() + this.ttlMs;
      return model;
    });
    entry.request.catch(() => {
      if (this.cache.get(key) === entry) this.cache.delete(key);
    });
    this.remember(key, entry);

    return entry.request;
  }

  private async load(orgId: string, credentialId?: string): Promise<ResolvedLlmModel> {
    const row = credentialId
      ? await this.repository.find(orgId, credentialId)
      : await this.repository.get(orgId);
    if (credentialId && !row) throw aiCredentialNotFound();
    const model = isUsableByok(row) ? this.fromByok(row) : null;
    if (!model) throw aiNotConfigured();
    return model;
  }

  private fromByok(row: ByokCredential): ResolvedLlmModel {
    let apiKey: string;
    try {
      apiKey = this.cipher.decrypt(row.encryptedApiKey);
    } catch (error) {
      if (!(error instanceof CredentialDecryptError)) throw error;
      LlmProviderResolver.logger.warn(
        `Stored AI credential ${row.id} could not be decrypted; check SOONWHY_PII_ENCRYPTION_KEY`,
      );
      throw aiCredentialUnreadable();
    }
    return {
      source: "byok",
      providerId: row.provider,
      model: row.model,
      baseUrl: this.endpointFor(row.provider, row.baseUrl),
      apiKey,
      credentialId: row.id,
    };
  }

  private endpointFor(
    providerId: string,
    baseUrl: string | null,
  ): string | null {
    return this.catalog.endpointFor(providerId, baseUrl);
  }

  private remember(key: string, entry: CacheEntry): void {
    if (this.cache.size >= MAX_CACHED_ORGS && !this.cache.has(key)) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, entry);
  }
}

function isUsableByok(row: CredentialRow): row is ByokCredential {
  return !!row && row.enabled && row.deletedAt === null;
}
