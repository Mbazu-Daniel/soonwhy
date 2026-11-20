import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MetricsController } from "./metrics.controller";

describe("host metrics", () => {
  const org = { orgId: "org-1" } as never;

  it("reads host metrics for the requested project", async () => {
    const getHostMetrics = vi.fn().mockResolvedValue({ buckets: [] });
    const controller = new MetricsController({ getHostMetrics } as never);

    await controller.getHostMetrics(org, { projectId: "p1", interval: "1m" });

    expect(getHostMetrics).toHaveBeenCalledWith("org-1", { projectId: "p1", interval: "1m" });
  });

  it("needs a project id", async () => {
    const getHostMetrics = vi.fn();
    const controller = new MetricsController({ getHostMetrics } as never);

    await expect(controller.getHostMetrics(org, { interval: "1m" })).rejects.toBeInstanceOf(BadRequestException);
    expect(getHostMetrics).not.toHaveBeenCalled();
  });
});
