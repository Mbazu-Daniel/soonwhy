import { Inject, Injectable, Logger } from "@nestjs/common";
import { AiRepository } from "./ai.repository";
import { CredentialCipher } from "./credential-cipher";
import { LlmCatalog } from "./llm-catalog.service";
import {
  buildProviderConfig,
  readLlmTuning,
  readPlatformLlmConfig,
  type LlmTuning,
  type PlatformLlmConfig,
} from "./llm-provider.config";
import {
  aiCredentialUnreadable,
  aiNotConfigured,
  CredentialDecryptError,
} from "./ai.errors";
import { MastraRcaProvider } from "../detections/rca.provider";
import type { RcaCredentialInfo } from "../detections/rca.types";
import type { LlmCredentialSource } from "../../../common/db/schema";

type CredentialRow = Awaited<ReturnType<AiRepository["get"]>>;
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
  /** `0` while the credential is still being read, an expiry stamp afterwards. */
  expiresAt: number;
  request: Promise<ResolvedLlmModel>;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_ORGS = 256;

@Injectable()
export class LlmProviderResolver {
  private static readonly logger = new Logger(LlmProviderResolver.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs =
    Number(process.env.SOONWHY_AI_CREDENTIAL_CACHE_TTL_MS) ||
    DEFAULT_CACHE_TTL_MS;
  private readonly platform: PlatformLlmConfig;
  private readonly tuning: LlmTuning;

  constructor(
    @Inject(AiRepository) private readonly repository: Pick<
      AiRepository,
      "get"
    >,
    private readonly cipher: CredentialCipher,
    private readonly catalog: LlmCatalog,
  ) {
    this.platform = readPlatformLlmConfig();
    this.tuning = readLlmTuning();
  }

  async resolveForRca(orgId: string): Promise<ResolvedLlmHandle> {
    const model = await this.resolve(orgId);
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

  /** Which credential would serve this org, without any key material. */
  async describe(orgId: string): Promise<LlmCredentialSummary> {
    const row = await this.repository.get(orgId);
    if (isUsableByok(row)) {
      return { source: "byok", provider: row.provider, model: row.model };
    }
    if (this.platform.configured) {
      return {
        source: "platform",
        provider: this.platform.providerId,
        model: this.platform.model,
      };
    }
    return { source: "none", provider: null, model: null };
  }

  /** Platform availability for the settings screen: never the platform key. */
  describePlatform() {
    return {
      configured: this.platform.configured,
      provider: this.platform.configured ? this.platform.providerId : null,
      model: this.platform.configured ? this.platform.model : null,
    };
  }

  /** Every write path calls this, so a saved or removed key takes effect at once. */
  invalidate(orgId: string): void {
    this.cache.delete(orgId);
  }

  /** Raw credential, key included: only for building a provider in this process. */
  async resolve(orgId: string): Promise<ResolvedLlmModel> {
    const cached = this.cache.get(orgId);
    if (cached && (cached.expiresAt === 0 || cached.expiresAt > Date.now())) {
      return cached.request;
    }

    const entry: CacheEntry = { expiresAt: 0, request: this.load(orgId) };
    entry.request = entry.request.then((model) => {
      entry.expiresAt = Date.now() + this.ttlMs;
      return model;
    });
    entry.request.catch(() => {
      if (this.cache.get(orgId) === entry) this.cache.delete(orgId);
    });
    this.remember(orgId, entry);

    return entry.request;
  }

  private async load(orgId: string): Promise<ResolvedLlmModel> {
    const row = await this.repository.get(orgId);
    const model = isUsableByok(row)
      ? this.fromByok(row)
      : this.fromPlatformOrNull();
    if (!model) throw aiNotConfigured();
    return model;
  }

  private fromByok(row: ByokCredential): ResolvedLlmModel {
    let apiKey: string;
    try {
      apiKey = this.cipher.decrypt(row.encryptedApiKey);
    } catch (error) {
      // A missing server key is a different fault with a different fix: only a
      // payload that genuinely will not open means the stored key is stale.
      if (!(error instanceof CredentialDecryptError)) throw error;
      LlmProviderResolver.logger.warn(
        `Stored AI credential ${row.id} could not be decrypted; check SOONWHY_CREDENTIAL_ENCRYPTION_KEY`,
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

  private fromPlatformOrNull(): ResolvedLlmModel | null {
    if (!this.platform.configured) return null;
    return {
      source: "platform",
      providerId: this.platform.providerId,
      model: this.platform.model,
      baseUrl: this.endpointFor(
        this.platform.providerId,
        this.platform.baseUrl,
      ),
      apiKey: this.platform.apiKey,
      credentialId: null,
    };
  }

  private endpointFor(
    providerId: string,
    baseUrl: string | null,
  ): string | null {
    return this.catalog.endpointFor(providerId, baseUrl);
  }

  private remember(orgId: string, entry: CacheEntry): void {
    if (this.cache.size >= MAX_CACHED_ORGS && !this.cache.has(orgId)) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(orgId, entry);
  }
}

function isUsableByok(row: CredentialRow): row is ByokCredential {
  return !!row && row.enabled && row.deletedAt === null;
}
