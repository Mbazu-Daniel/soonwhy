import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../common/db";
import { detectorSettings } from "../../../common/db/schema";
import { CacheService } from "../../../common/cache/cache.service";
import { CACHE_TTL_SECONDS } from "../../../common/cache/cache.constants";
import {
  DETECTOR_DEFINITIONS,
  FEATURE_FLAG_DEFINITIONS,
} from "./detector-settings.constants";
import {
  effectiveDetectors,
  effectiveFeatureFlags,
  isDetectorEnabled,
  isFeatureEnabled,
  mergeDetectorOverrides,
  normalizeDetectorOverrides,
  normalizeFeatureFlags,
  parseDetectorSettingsPatch,
  thresholdOverride,
  type DetectorSettingsPatch,
  type DetectorSettingsSnapshot,
} from "./detector-settings.validation";

const CACHE_PREFIX = "detector-settings:v1";

@Injectable()
export class DetectorSettingsService {
  private readonly logger = new Logger(DetectorSettingsService.name);

  constructor(private readonly cache: CacheService) {}

  async get(organizationId: string): Promise<DetectorSettingsSnapshot> {
    const cached = await this.cache.getJson<DetectorSettingsSnapshot>(
      `${CACHE_PREFIX}:${organizationId}`,
    );
    if (cached) return cached;

    try {
      const [row] = await db
        .select()
        .from(detectorSettings)
        .where(eq(detectorSettings.organizationId, organizationId))
        .limit(1);

      const snapshot = this.snapshotFromRow(organizationId, row);
      await this.cache.setJson(
        `${CACHE_PREFIX}:${organizationId}`,
        snapshot,
        CACHE_TTL_SECONDS.detectorSettings,
      );
      return snapshot;
    } catch (error) {
      this.logger.warn(
        `Detector settings unavailable for organisation ${organizationId}; using defaults`,
        error instanceof Error ? error.stack : String(error),
      );
      return this.snapshotFromRow(organizationId, undefined);
    }
  }

  async update(
    organizationId: string,
    rawPatch: unknown,
    mode: "merge" | "replace" = "merge",
  ): Promise<DetectorSettingsSnapshot> {
    let patch: DetectorSettingsPatch;
    try {
      patch = parseDetectorSettingsPatch(rawPatch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BadRequestException(
          error.issues.map((issue) => issue.message).join("; "),
        );
      }
      throw error;
    }

    const existing = await this.loadOverrides(organizationId);
    const detectors =
      mode === "replace"
        ? (patch.detectors ?? {})
        : mergeDetectorOverrides(existing.detectors, patch.detectors);
    const featureFlags =
      mode === "replace"
        ? (patch.featureFlags ?? {})
        : { ...existing.featureFlags, ...(patch.featureFlags ?? {}) };

    await db
      .insert(detectorSettings)
      .values({
        organizationId,
        detectors,
        featureFlags,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: detectorSettings.organizationId,
        set: {
          detectors,
          featureFlags,
          updatedAt: new Date(),
        },
      });

    await this.clearCache(organizationId);
    return this.get(organizationId);
  }

  async reset(organizationId: string): Promise<DetectorSettingsSnapshot> {
    const result = await db
      .delete(detectorSettings)
      .where(eq(detectorSettings.organizationId, organizationId))
      .returning({ organizationId: detectorSettings.organizationId });

    await this.clearCache(organizationId);
    if (result.length === 0) return this.snapshotFromRow(organizationId, undefined);
    return this.get(organizationId);
  }

  async getOrThrow(organizationId: string): Promise<DetectorSettingsSnapshot> {
    const snapshot = await this.get(organizationId);
    if (!snapshot) throw new NotFoundException("Detector settings not found");
    return snapshot;
  }

  featureEnabled(
    snapshot: DetectorSettingsSnapshot,
    key: string,
  ): boolean {
    return isFeatureEnabled(snapshot.featureFlags, key);
  }

  detectorEnabled(
    snapshot: DetectorSettingsSnapshot,
    key: string,
  ): boolean {
    return isDetectorEnabled(snapshot.detectors, key);
  }

  threshold(
    snapshot: DetectorSettingsSnapshot,
    detector: string,
    key: string,
  ): number | undefined {
    return thresholdOverride(snapshot.detectors, detector, key);
  }

  async clearCache(organizationId: string): Promise<void> {
    await Promise.all([
      this.cache.delete(`${CACHE_PREFIX}:${organizationId}`),
      this.cache.deleteByPrefix(`detections:service-buckets:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:endpoint-buckets:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:dependency-buckets:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:database-connection-pool:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:database-connection-wait:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:request-endpoints:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:database-query-spans:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:runtime-metrics:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:trace-durations:${organizationId}:`),
      this.cache.deleteByPrefix(`detections:trace-span-candidates:${organizationId}:`),
    ]);
  }

  private async loadOverrides(organizationId: string) {
    const [row] = await db
      .select()
      .from(detectorSettings)
      .where(eq(detectorSettings.organizationId, organizationId))
      .limit(1);

    return {
      detectors: normalizeDetectorOverrides(row?.detectors),
      featureFlags: normalizeFeatureFlags(row?.featureFlags),
    };
  }

  private snapshotFromRow(
    organizationId: string,
    row: typeof detectorSettings.$inferSelect | undefined,
  ): DetectorSettingsSnapshot {
    const detectorOverrides = normalizeDetectorOverrides(row?.detectors);
    const flagOverrides = normalizeFeatureFlags(row?.featureFlags);

    return {
      organizationId,
      overrides: {
        detectors: detectorOverrides,
        featureFlags: flagOverrides,
      },
      detectors: effectiveDetectors(detectorOverrides),
      featureFlags: effectiveFeatureFlags(flagOverrides),
      knownDetectors: DETECTOR_DEFINITIONS,
      knownFeatureFlags: FEATURE_FLAG_DEFINITIONS,
      ...(row?.updatedAt
        ? { updatedAt: row.updatedAt.toISOString() }
        : {}),
    };
  }
}
