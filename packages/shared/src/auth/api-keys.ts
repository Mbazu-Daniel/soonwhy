import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { apiKeys, projects, projectSettings, serviceAccounts } from "../db/schema";
import type { CaptureSettings } from "../capture-settings";
import type { Db } from "../db";
import { DB } from "../db";
import type { ApiKeyAuthentication, ValidatedApiKey } from "./api-keys.types";

@Injectable()
export class ApiKeyAuthenticator {
  constructor(@Inject(DB) private readonly db: Db) {}

  private readonly logger = new Logger(ApiKeyAuthenticator.name);

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
    const rows = await this.db
      .select({
        id: apiKeys.id,
        projectId: apiKeys.projectId,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        serviceAccountId: apiKeys.serviceAccountId,
        serviceAccountDisabledAt: serviceAccounts.disabledAt,
        organizationId: projects.organizationId,
        maxAttributeCount: projectSettings.maxAttributeCount,
        maxAttributeValueLength: projectSettings.maxAttributeValueLength,
      })
      .from(apiKeys)
      .innerJoin(projects, eq(apiKeys.projectId, projects.id))
      .leftJoin(projectSettings, eq(projectSettings.projectId, projects.id))
      .leftJoin(serviceAccounts, eq(serviceAccounts.id, apiKeys.serviceAccountId))
      .where(eq(apiKeys.keyHash, keyHash));

    const key = rows[0];
    if (!key) return undefined;
    if (key.expiresAt && key.expiresAt < new Date()) return undefined;
    if (key.serviceAccountId && key.serviceAccountDisabledAt) return undefined;

    try {
      await this.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, key.id));
    } catch (error) {
      this.logger.warn(
        `Failed to record last_used_at for an api key: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      projectId: key.projectId,
      organizationId: key.organizationId,
      scopes: key.scopes ?? [],
      captureSettings: {
        redactSensitiveData: true,
        captureRequestHeaders: true,
        captureRequestBody: true,
        captureResponseBody: true,
        maxAttributeCount: key.maxAttributeCount ?? 100,
        maxAttributeValueLength: key.maxAttributeValueLength ?? 4096,
      } as CaptureSettings,
    };
  }
}

export function apiKeyFromAuthorization(
  authorization: string | undefined,
): string | undefined {
  if (!authorization) return undefined;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}
