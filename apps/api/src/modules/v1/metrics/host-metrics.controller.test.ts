import { describe, expect, it, vi } from "vitest";
import { MetricsController } from "./metrics.controller";

describe("host metrics", () => {
  const org = { orgId: "org-1" } as never;

  it("reads host metrics for the organization without needing a project", async () => {
    const getHostMetrics = vi.fn().mockResolvedValue({ buckets: [] });
    const controller = new MetricsController({ getHostMetrics } as never);

    await controller.getHostMetrics(org, { interval: "1m" });

    expect(getHostMetrics).toHaveBeenCalledWith("org-1", { interval: "1m" });
  });

  it("ignores a project id that older pages still send", async () => {
    const getHostMetrics = vi.fn().mockResolvedValue({ buckets: [] });
    const controller = new MetricsController({ getHostMetrics } as never);

    await controller.getHostMetrics(org, { projectId: "p1", from: "a", to: "b" });

    expect(getHostMetrics).toHaveBeenCalledWith("org-1", { from: "a", to: "b" });
  });
});
