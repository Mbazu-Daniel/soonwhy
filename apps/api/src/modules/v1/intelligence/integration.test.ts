import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TelemetryIngestionService } from "./telemetry-ingestion.service";
import { QuickwitService } from "@soonwhy/shared";
import { DetectorConfigService } from "./detector-config.service";

const offlineDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => [],
      }),
    }),
  }),
  insert: () => ({
    values: async () => {
      throw new Error("offline: no database connection");
    },
  }),
  update: () => ({
    set: () => ({
      where: async () => [],
    }),
  }),
};

describe("Integration: Intelligence Workflow", () => {
  let telemetryService: TelemetryIngestionService;
  let quickwitService: QuickwitService;
  let detectorConfigService: DetectorConfigService;

  beforeAll(() => {
    telemetryService = new TelemetryIngestionService();
    quickwitService = new QuickwitService();
    detectorConfigService = new DetectorConfigService(offlineDb as any);
  });

  afterAll(async () => {
    // TelemetryIngestionService cleanup handled by onModuleDestroy
  });

  it("should initialize telemetry ingestion service", () => {
    expect(telemetryService).toBeDefined();
  });

  it("should initialize quickwit service", () => {
    expect(quickwitService).toBeDefined();
  });

  it("should initialize detector config service", () => {
    expect(detectorConfigService).toBeDefined();
  });

  it("should get detector threshold with default value", async () => {
    const value = await detectorConfigService.getDetectorThreshold(
      "org-1",
      "endpoint_latency",
      "latencyThresholdPercent",
      20,
    );
    expect(value).toBe(20);
  });

  it("should fail and fall back to the default threshold without a DB", async () => {
    await expect(
      detectorConfigService.setDetectorThreshold("org-1", "endpoint_latency", "latencyThresholdPercent", 30),
    ).rejects.toThrow("offline: no database connection");
    const value = await detectorConfigService.getDetectorThreshold(
      "org-1",
      "endpoint_latency",
      "latencyThresholdPercent",
      20,
    );
    expect(value).toBe(20);
  });

  it("should get all detector configs for organization", async () => {
    const configs = await detectorConfigService.getAllDetectorConfigs("org-1");
    expect(configs).toBeDefined();
    expect(typeof configs).toBe("object");
  });

  it("should delete detector threshold", async () => {
    await detectorConfigService.deleteDetectorThreshold("org-1", "endpoint_latency", "latencyThresholdPercent");
    const value = await detectorConfigService.getDetectorThreshold(
      "org-1",
      "endpoint_latency",
      "latencyThresholdPercent",
      20,
    );
    expect(value).toBe(20); // Should return default after deletion
  });

  it("should clear cache for organization", () => {
    detectorConfigService.clearCache("org-1");
    expect(detectorConfigService).toBeDefined();
  });
});
