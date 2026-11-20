import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.hoisted(() => ({
  startDetectionRun: vi.fn(),
  completeDetectionRun: vi.fn(),
  failDetectionRun: vi.fn(),
  enqueueDetectionRun: vi.fn(),
  claimQueuedDetectionRun: vi.fn(),
}));
vi.mock("./detection.run", () => run);
vi.mock("../../../../../common/telemetry/otel-metrics", () => ({ recordDetectionRun: vi.fn() }));

import { DetectionRuns } from "./detection-runs.service";

function build(options: { enabled?: boolean; async?: boolean; project?: boolean; pipeline?: () => Promise<unknown[]> } = {}) {
  const features = { "detections.enabled": options.enabled ?? true, "detections.async": options.async ?? true } as Record<string, boolean>;
  const pipeline = { execute: vi.fn(options.pipeline ?? (async () => [{ id: "f1" }, { id: "f2" }])) };
  const detectorSettings = { get: vi.fn().mockResolvedValue({}), featureEnabled: vi.fn((_: unknown, key: string) => features[key]) };
  const projects = { getProjectById: vi.fn().mockResolvedValue(options.project === false ? undefined : { id: "p1" }) };
  const telemetry = { runStarted: vi.fn(), runCompleted: vi.fn(), runFailed: vi.fn(), flush: vi.fn() };
  const runs = new DetectionRuns(pipeline as never, projects as never, detectorSettings as never, telemetry as never);
  return { runs, pipeline, telemetry };
}

beforeEach(() => {
  vi.clearAllMocks();
  run.startDetectionRun.mockResolvedValue({ id: "run-1" });
  run.enqueueDetectionRun.mockResolvedValue({ id: "run-2" });
});

describe("DetectionRuns.run", () => {
  it("refuses when detections are off, without creating a run", async () => {
    const { runs } = build({ enabled: false });
    await expect(runs.run("o1", "p1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(run.startDetectionRun).not.toHaveBeenCalled();
  });

  it("refuses an unknown project, without creating a run", async () => {
    const { runs } = build({ project: false });
    await expect(runs.run("o1", "p1")).rejects.toBeInstanceOf(NotFoundException);
    expect(run.startDetectionRun).not.toHaveBeenCalled();
  });

  it("completes the run with the finding count and flushes telemetry", async () => {
    const { runs, telemetry } = build();
    const findings = await runs.run("o1", "p1");
    expect(findings).toHaveLength(2);
    expect(run.completeDetectionRun).toHaveBeenCalledWith("run-1", 2);
    expect(run.failDetectionRun).not.toHaveBeenCalled();
    expect(telemetry.runCompleted).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1", findingsCount: 2 }));
    expect(telemetry.flush).toHaveBeenCalledTimes(1);
  });

  it("fails the run, reports it, flushes and rethrows when the pipeline throws", async () => {
    const { runs, telemetry } = build({ pipeline: async () => { throw new Error("boom"); } });
    await expect(runs.run("o1", "p1")).rejects.toThrow("boom");
    expect(run.failDetectionRun).toHaveBeenCalledWith("run-1", "boom");
    expect(run.completeDetectionRun).not.toHaveBeenCalled();
    expect(telemetry.runFailed).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
    expect(telemetry.flush).toHaveBeenCalledTimes(1);
  });
});

describe("DetectionRuns.enqueue", () => {
  it("needs both the detections and the async setting", async () => {
    await expect(build({ async: false }).runs.enqueue("o1", "p1")).rejects.toThrow("Async detection runs are disabled");
    await expect(build({ enabled: false }).runs.enqueue("o1", "p1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(run.enqueueDetectionRun).not.toHaveBeenCalled();
  });

  it("queues a run for the last window", async () => {
    const queued = await build().runs.enqueue("o1", "p1");
    expect(queued).toMatchObject({ id: "run-2", status: "queued" });
    expect(queued.windowEnd.getTime() - queued.windowStart.getTime()).toBeGreaterThan(0);
  });
});

describe("DetectionRuns.runNext", () => {
  it("does nothing when no run is queued", async () => {
    const { runs, pipeline } = build();
    run.claimQueuedDetectionRun.mockResolvedValue(undefined);
    await expect(runs.runNext()).resolves.toBeUndefined();
    expect(pipeline.execute).not.toHaveBeenCalled();
  });

  it("runs the claimed run and returns its id", async () => {
    const { runs } = build();
    run.claimQueuedDetectionRun.mockResolvedValue({ id: "run-9", orgId: "o1", projectId: "p1", windowStart: new Date(0), windowEnd: new Date(1) });
    await expect(runs.runNext()).resolves.toBe("run-9");
    expect(run.completeDetectionRun).toHaveBeenCalledWith("run-9", 2);
  });

  it("fails a claimed run whose organization turned detections off, instead of leaving it running", async () => {
    const { runs, pipeline } = build({ enabled: false });
    run.claimQueuedDetectionRun.mockResolvedValue({ id: "run-9", orgId: "o1", projectId: "p1", windowStart: new Date(0), windowEnd: new Date(1) });
    await expect(runs.runNext()).rejects.toBeInstanceOf(ForbiddenException);
    expect(run.failDetectionRun).toHaveBeenCalledWith("run-9", "Detections are disabled for this organisation");
    expect(pipeline.execute).not.toHaveBeenCalled();
  });

  it("fails a claimed run whose project is gone", async () => {
    const { runs } = build({ project: false });
    run.claimQueuedDetectionRun.mockResolvedValue({ id: "run-9", orgId: "o1", projectId: "p1", windowStart: new Date(0), windowEnd: new Date(1) });
    await expect(runs.runNext()).rejects.toBeInstanceOf(NotFoundException);
    expect(run.failDetectionRun).toHaveBeenCalledWith("run-9", "Project not found");
  });
});
