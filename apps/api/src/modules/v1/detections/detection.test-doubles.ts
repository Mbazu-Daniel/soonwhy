import { vi } from "vitest";
import type { QuickwitService } from "@soonwhy/shared";
import { DetectionPipeline } from "./detection.pipeline";
import { DetectionService } from "./detection.service";

export function detectorSettingsDouble(enabled = true) {
  return {
    get: vi.fn().mockResolvedValue({}),
    featureEnabled: vi.fn().mockReturnValue(enabled),
    detectorEnabled: vi.fn().mockReturnValue(enabled),
    threshold: vi.fn().mockReturnValue(undefined),
  };
}

export function cacheDouble() {
  return {
    getOrSet: vi.fn(
      async (
        _key: string,
        _ttlSeconds: number,
        load: () => Promise<unknown>,
      ) => load(),
    ),
    getJson: vi.fn().mockResolvedValue(null),
    setJson: vi.fn().mockResolvedValue(undefined),
  };
}

export function detectionTelemetryDouble() {
  return {
    runStarted: vi.fn().mockResolvedValue(undefined),
    trackFinding: vi.fn().mockResolvedValue(undefined),
    runCompleted: vi.fn().mockResolvedValue(undefined),
    runFailed: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue({
      buffered: 0,
      published: 0,
      dropped: 0,
      batches: 0,
    }),
  };
}

export function createDetectionService(
  quickwit: QuickwitService,
  issueLifecycleService: unknown,
  options: { projectFound?: boolean } = {},
): DetectionService {
  const detectorSettings = detectorSettingsDouble();
  const detectionTelemetry = detectionTelemetryDouble();
  const pipeline = new DetectionPipeline(
    quickwit,
    cacheDouble() as never,
    detectorSettings as never,
    detectionTelemetry as never,
    issueLifecycleService as never,
  );

  return new DetectionService(
    pipeline,
    quickwit,
    {
      getProjectById: vi.fn().mockResolvedValue(
        options.projectFound === false
          ? undefined
          : { id: "project-1", orgId: "org-1" },
      ),
    } as never,
    detectorSettings as never,
    detectionTelemetry as never,
  );
}
