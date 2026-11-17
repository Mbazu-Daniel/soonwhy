import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { platformSettings, projects, projectSettings } from "../db/schema";
import type { CaptureSettings } from "../capture-settings";
import type { Db } from "../db";
import { DB } from "../db";
import type { ValidatedApiKey } from "./api-keys.types";

export const HOST_METRICS_PROJECT_SETTING = "host_metrics_project_id";

const CACHE_TTL_MS = 30_000;

interface Cached {
  target: ValidatedApiKey | undefined;
  validUntil: number;
}

@Injectable()
export class HostMetricsTarget {
  private cached: Cached | undefined;

  constructor(@Inject(DB) private readonly db: Db) {}

  async resolve(now = Date.now()): Promise<ValidatedApiKey | undefined> {
    if (this.cached && this.cached.validUntil > now) return this.cached.target;
    const target = await this.lookup();
    this.cached = { target, validUntil: now + CACHE_TTL_MS };
    return target;
  }

  private async lookup(): Promise<ValidatedApiKey | undefined> {
    const [setting] = await this.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, HOST_METRICS_PROJECT_SETTING));
    const saved = setting?.value.trim();
    const found = saved ? await this.projectTarget(saved) : undefined;
    if (found) return found;
    return this.chooseFirstProject();
  }

  private async chooseFirstProject(): Promise<ValidatedApiKey | undefined> {
    const [first] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .orderBy(asc(projects.createdAt), asc(projects.id))
      .limit(1);
    if (!first) return undefined;
    await this.db
      .insert(platformSettings)
      .values({ key: HOST_METRICS_PROJECT_SETTING, value: first.id })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: first.id, updatedAt: new Date() },
      });
    return this.projectTarget(first.id);
  }

  async projectTarget(projectId: string): Promise<ValidatedApiKey | undefined> {
    const [row] = await this.db
      .select({
        projectId: projects.id,
        organizationId: projects.organizationId,
        maxAttributeCount: projectSettings.maxAttributeCount,
        maxAttributeValueLength: projectSettings.maxAttributeValueLength,
      })
      .from(projects)
      .leftJoin(projectSettings, eq(projectSettings.projectId, projects.id))
      .where(eq(projects.id, projectId));
    if (!row) return undefined;
    return {
      projectId: row.projectId,
      organizationId: row.organizationId,
      scopes: ["ingest"],
      captureSettings: {
        redactSensitiveData: true,
        captureRequestHeaders: true,
        captureRequestBody: true,
        captureResponseBody: true,
        maxAttributeCount: row.maxAttributeCount ?? 100,
        maxAttributeValueLength: row.maxAttributeValueLength ?? 4096,
      } as CaptureSettings,
    };
  }
}
