import { Injectable, Inject } from "@nestjs/common";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { apiKeys, projects, projectSettings } from "../db/schema";
import type { CaptureSettings } from "../capture-settings";
import type { Db } from "../db";
import { DB } from "../db";
import type { ValidatedApiKey } from "./api-keys.types";

@Injectable()
export class ApiKeysService {
  constructor(@Inject(DB) private readonly db: Db) {}

  private hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  async validateKey(rawKey: string): Promise<ValidatedApiKey | undefined> {
    const keyHash = this.hashKey(rawKey);
    const rows = await this.db
      .select({
        projectId: apiKeys.projectId,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        organizationId: projects.organizationId,
        redactSensitiveData: projectSettings.redactSensitiveData,
        captureRequestHeaders: projectSettings.captureRequestHeaders,
        captureRequestBody: projectSettings.captureRequestBody,
        captureResponseBody: projectSettings.captureResponseBody,
        maxAttributeCount: projectSettings.maxAttributeCount,
        maxAttributeValueLength: projectSettings.maxAttributeValueLength,
      })
      .from(apiKeys)
      .innerJoin(projects, eq(apiKeys.projectId, projects.id))
      .leftJoin(projectSettings, eq(projectSettings.projectId, projects.id))
      .where(eq(apiKeys.keyHash, keyHash));

    const key = rows[0];
    if (!key) return undefined;
    if (key.expiresAt && key.expiresAt < new Date()) return undefined;

    return {
      projectId: key.projectId,
      organizationId: key.organizationId,
      scopes: key.scopes ?? [],
      captureSettings: {
        redactSensitiveData: key.redactSensitiveData ?? true,
        captureRequestHeaders: key.captureRequestHeaders ?? false,
        captureRequestBody: key.captureRequestBody ?? false,
        captureResponseBody: key.captureResponseBody ?? false,
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
