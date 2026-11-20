import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { apiKeys, organizations, projects, projectSettings, serviceAccounts } from "../db/schema";
import type { CaptureSettings } from "../capture-settings.types";
import type { Db } from "../db";
import { DB } from "../db";
import type { ApiKeyAuthentication, ValidatedApiKey } from "./api-keys.types";

const KEY_CACHE_TTL_MS = 30_000;
const UNKNOWN_KEY_CACHE_TTL_MS = 5_000;
const LAST_USED_WRITE_INTERVAL_MS = 60_000;
const KEY_CACHE_MAX_ENTRIES = 5_000;

interface CachedKey {
  key: (ValidatedApiKey & { id: string; expiresAt: Date | null }) | undefined;
  validUntil: number;
}

@Injectable()
export class ApiKeyAuthenticator {
  constructor(@Inject(DB) private readonly db: Db) {}

  private readonly logger = new Logger(ApiKeyAuthenticator.name);
  private readonly cache = new Map<string, CachedKey>();
  private readonly lastUsedWrittenAt = new Map<string, number>();

  private hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  async authenticate(
    authorization: string | undefined,
    options: { scope?: string } = {},
  ): Promise<ApiKeyAuthentication> {
    const rawKey = apiKeyFromAuthorization(authorization);
    if (!rawKey) return { ok: false, reason: "missing", message: "Missing or invalid API key" };
    const key = await this.validateKey(rawKey);
    if (!key) return { ok: false, reason: "invalid", message: "Invalid or expired API key" };
    if (options.scope && !key.scopes.includes(options.scope)) {
      return { ok: false, reason: "scope", message: `The API key needs the ${options.scope} scope` };
    }
    return { ok: true, key };
  }

  private async validateKey(rawKey: string): Promise<ValidatedApiKey | undefined> {
    const keyHash = this.hashKey(rawKey);
    const now = Date.now();
    let cached = this.cache.get(keyHash);
    if (!cached || cached.validUntil <= now) {
      cached = await this.lookupKey(keyHash, now);
    }
    const key = cached.key;
    if (!key) return undefined;
    if (key.expiresAt && key.expiresAt.getTime() < now) return undefined;
    this.recordUse(key.id, now);
    const { id: _id, expiresAt: _expiresAt, ...validated } = key;
    return validated;
  }

  private async lookupKey(keyHash: string, now: number): Promise<CachedKey> {
    const rows = await this.db
      .select({
        id: apiKeys.id,
        projectId: apiKeys.projectId,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        serviceAccountId: apiKeys.serviceAccountId,
        serviceAccountDisabledAt: serviceAccounts.disabledAt,
        organizationId: projects.organizationId,
        organizationDeletedAt: organizations.deletedAt,
        maxAttributeCount: projectSettings.maxAttributeCount,
        maxAttributeValueLength: projectSettings.maxAttributeValueLength,
      })
      .from(apiKeys)
      .innerJoin(projects, eq(apiKeys.projectId, projects.id))
      .innerJoin(organizations, eq(organizations.id, projects.organizationId))
      .leftJoin(projectSettings, eq(projectSettings.projectId, projects.id))
      .leftJoin(serviceAccounts, eq(serviceAccounts.id, apiKeys.serviceAccountId))
      .where(eq(apiKeys.keyHash, keyHash));

    const row = rows[0];
    const usable =
      row && !row.organizationDeletedAt && !(row.serviceAccountId && row.serviceAccountDisabledAt);
    const entry: CachedKey = {
      key: usable
        ? {
            id: row.id,
            expiresAt: row.expiresAt,
            projectId: row.projectId,
            organizationId: row.organizationId,
            scopes: row.scopes ?? [],
            captureSettings: {
              redactSensitiveData: true,
              captureRequestHeaders: true,
              captureRequestBody: true,
              captureResponseBody: true,
              maxAttributeCount: row.maxAttributeCount ?? 100,
              maxAttributeValueLength: row.maxAttributeValueLength ?? 4096,
            } as CaptureSettings,
          }
        : undefined,
      validUntil: now + (usable ? KEY_CACHE_TTL_MS : UNKNOWN_KEY_CACHE_TTL_MS),
    };
    if (this.cache.size >= KEY_CACHE_MAX_ENTRIES) this.cache.clear();
    this.cache.set(keyHash, entry);
    return entry;
  }

  private recordUse(keyId: string, now: number): void {
    const last = this.lastUsedWrittenAt.get(keyId) ?? 0;
    if (now - last < LAST_USED_WRITE_INTERVAL_MS) return;
    if (this.lastUsedWrittenAt.size >= KEY_CACHE_MAX_ENTRIES) this.lastUsedWrittenAt.clear();
    this.lastUsedWrittenAt.set(keyId, now);
    void this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(apiKeys.id, keyId))
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to record last_used_at for an api key: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }
}

export function apiKeyFromAuthorization(
  authorization: string | undefined,
): string | undefined {
  if (!authorization) return undefined;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}
