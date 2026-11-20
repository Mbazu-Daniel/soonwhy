import { describe, expect, it, vi } from "vitest";
import { DetectionJobRunner } from "./detection-job.runner";

describe("DetectionJobRunner shutdown", () => {
  it("waits for the run in progress and claims nothing afterwards", async () => {
    let finish: () => void = () => undefined;
    const runNext = vi.fn().mockImplementation(() => new Promise<string>((resolve) => { finish = () => resolve("run"); }));
    const runner = new DetectionJobRunner({ runNext } as never);

    const tick = runner.runQueuedJobs();
    let shutdownDone = false;
    const shutdown = runner.beforeApplicationShutdown().then(() => { shutdownDone = true; });
    await Promise.resolve();
    expect(shutdownDone).toBe(false);

    finish();
    await tick;
    await shutdown;
    expect(shutdownDone).toBe(true);

    await runner.runQueuedJobs();
    expect(runNext).toHaveBeenCalledTimes(1);
  });
});
