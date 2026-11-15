import { Inject, Injectable, Logger } from "@nestjs/common";
import { AiRepository } from "./ai.repository";
import { CredentialCipher } from "./credential-cipher";
import { LlmCatalog } from "./llm-catalog.service";
import {
  buildProviderConfig,
  readLlmTuning,
  type LlmTuning,
} from "./llm-provider.config";
import {
  aiCredentialNotFound,
  aiCredentialUnreadable,
  aiNotConfigured,
  CredentialDecryptError,
} from "./ai.errors";
import { MastraRcaProvider } from "../detections/rca.provider";
import type { RcaCredentialInfo } from "../detections/rca.types";
import type { LlmCredentialSource } from "../../../common/db/schema";

type CredentialRow = Awaited<ReturnType<AiRepository["find"]>>;
type ByokCredential = NonNullable<CredentialRow>;

export interface ResolvedLlmModel {
  readonly source: LlmCredentialSource;
  readonly providerId: string;
  readonly model: string;
  readonly baseUrl: string | null;
  readonly apiKey: string;
  readonly credentialId: string | null;
}

export interface ResolvedLlmHandle {
  readonly provider: MastraRcaProvider;
  readonly credential: RcaCredentialInfo;
  readonly promptVersion: string;
}

export interface LlmCredentialSummary {
  readonly source: LlmCredentialSource | "none";
  readonly provider: string | null;
  readonly model: string | null;
}

interface CacheEntry {
  expiresAt: number;
  request: Promise<ResolvedLlmModel>;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_ORGS = 256;
const KEY_SEPARATOR = "\u0000";

@Injectable()
export class LlmProviderResolver {
  private static readonly logger = new Logger(LlmProviderResolver.name);
  private readonly cache = new Map<string, CacheEntry>();
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
  ) {
    this.tuning = readLlmTuning();
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
