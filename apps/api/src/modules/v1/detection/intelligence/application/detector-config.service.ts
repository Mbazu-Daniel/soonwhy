import { Injectable, Logger, Optional } from "@nestjs/common";
import type { AppDatabase } from "../../../../../common/db/types";
import { eq } from "drizzle-orm";
import { detectorSettings, type DetectorConfigRow } from "../../../../../common/db/schema/detector-settings";
import { CacheService } from "../../../../../common/cache/cache.service";
import { db } from "../../../../../common/db";

@Injectable()
export class DetectorConfigService {
  private readonly logger = new Logger(DetectorConfigService.name);
  private readonly CACHE_TTL = 3600;

  constructor(
    @Optional() private readonly customDb?: AppDatabase,
    @Optional() private readonly cache?: CacheService,
  ) {
    this.db = customDb || db;
  }

  private readonly db: AppDatabase;

  async getDetectorThreshold(
    organizationId: string,
    detectorName: string,
    thresholdName: string,
    defaultValue: number,
  ): Promise<number> {
    const cacheKey = `${organizationId}:${detectorName}:${thresholdName}`;

    if (this.cache) {
      return this.cache.getOrSet(cacheKey, this.CACHE_TTL, () =>
        this.loadThreshold(organizationId, detectorName, thresholdName, defaultValue),
      );
    }
    return this.loadThreshold(organizationId, detectorName, thresholdName, defaultValue);
  }

  private async loadThreshold(
    organizationId: string,
    detectorName: string,
    thresholdName: string,
    defaultValue: number,
  ): Promise<number> {
    if (this.db) {
      try {
        const result = await this.db
          .select()
          .from(detectorSettings)
          .where(eq(detectorSettings.organizationId, organizationId))
          .limit(1);

        if (result.length > 0 && result[0]) {
          const row = result[0];
          const detectorConfig = row.detectors[detectorName] as DetectorConfigRow | undefined;
          if (detectorConfig?.thresholds && detectorConfig.thresholds[thresholdName] !== undefined) {
            return detectorConfig.thresholds[thresholdName];
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch detector config: ${error}`);
      }
    }

    return defaultValue;
  }

  async setDetectorThreshold(
    organizationId: string,
    detectorName: string,
    thresholdName: string,
    thresholdValue: number,
  ): Promise<void> {
    if (!this.db) {
      throw new Error("Database not available");
    }

    const cacheKey = `${organizationId}:${detectorName}:${thresholdName}`;

    try {
      const existing = await this.db
        .select()
        .from(detectorSettings)
        .where(eq(detectorSettings.organizationId, organizationId))
        .limit(1);

      if (existing.length > 0 && existing[0]) {
        const row = existing[0];
        const detectors = row.detectors || {};
        const detectorConfig = detectors[detectorName] as DetectorConfigRow | undefined || { enabled: true, thresholds: {} };
        detectorConfig.thresholds = detectorConfig.thresholds || {};
        detectorConfig.thresholds[thresholdName] = thresholdValue;
        detectors[detectorName] = detectorConfig;

        await this.db
          .update(detectorSettings)
          .set({ detectors, updatedAt: new Date() })
          .where(eq(detectorSettings.organizationId, organizationId));
      } else {
        const detectors: Record<string, DetectorConfigRow> = {};
        detectors[detectorName] = {
          enabled: true,
          thresholds: { [thresholdName]: thresholdValue },
        };

        await this.db.insert(detectorSettings).values({
          organizationId,
          detectors,
        });
      }

      if (this.cache) {
        await this.cache.setJson(cacheKey, thresholdValue, this.CACHE_TTL);
      }
    } catch (error) {
      this.logger.error(`Failed to set detector config: ${error}`);
      throw error;
    }
  }

  async listDetectorConfigs(organizationId: string): Promise<Record<string, Record<string, number>>> {
    if (!this.db) {
      return {};
    }

    try {
      const result = await this.db
        .select()
        .from(detectorSettings)
        .where(eq(detectorSettings.organizationId, organizationId))
        .limit(1);

      if (result.length === 0 || !result[0]) {
        return {};
      }

      const row = result[0];
      const configs: Record<string, Record<string, number>> = {};

      for (const [detectorName, detectorConfig] of Object.entries(row.detectors)) {
        if (detectorConfig?.thresholds) {
          configs[detectorName] = detectorConfig.thresholds;
          for (const [thresholdName, thresholdValue] of Object.entries(detectorConfig.thresholds)) {
            const cacheKey = `${organizationId}:${detectorName}:${thresholdName}`;
            if (this.cache) {
              await this.cache.setJson(cacheKey, thresholdValue, this.CACHE_TTL);
            }
          }
        }
      }

      return configs;
    } catch (error) {
      this.logger.warn(`Failed to list detector configs: ${error}`);
      return {};
    }
  }

  async deleteDetectorThreshold(
    organizationId: string,
    detectorName: string,
    thresholdName: string,
  ): Promise<void> {
    if (!this.db) {
      throw new Error("Database not available");
    }

    const cacheKey = `${organizationId}:${detectorName}:${thresholdName}`;

    try {
      const existing = await this.db
        .select()
        .from(detectorSettings)
        .where(eq(detectorSettings.organizationId, organizationId))
        .limit(1);

      if (existing.length > 0 && existing[0]) {
        const row = existing[0];
        const detectors = row.detectors || {};
        const detectorConfig = detectors[detectorName] as DetectorConfigRow | undefined;
        if (detectorConfig?.thresholds) {
          delete detectorConfig.thresholds[thresholdName];
          await this.db
            .update(detectorSettings)
            .set({ detectors, updatedAt: new Date() })
            .where(eq(detectorSettings.organizationId, organizationId));
        }
      }

      if (this.cache) {
        await this.cache.delete(cacheKey);
      }
    } catch (error) {
      this.logger.error(`Failed to delete detector config: ${error}`);
      throw error;
    }
  }

  async clearCache(organizationId: string): Promise<void> {
    if (this.cache) {
      await this.cache.deleteByPrefix(`${organizationId}:`);
    }
  }

  async getDetectorConfigs(organizationId: string, detectorName: string): Promise<Record<string, number>> {
    const allConfigs = await this.listDetectorConfigs(organizationId);
    return allConfigs[detectorName] || {};
  }

  async getAllDetectorConfigs(organizationId: string): Promise<Record<string, Record<string, number>>> {
    return this.listDetectorConfigs(organizationId);
  }
}
