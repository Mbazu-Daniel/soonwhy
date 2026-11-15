import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MetricsController } from "./metrics.controller";

describe("host metrics", () => {
  const org = { orgId: "org-1" } as never;

  it("asks for a project instead of failing with a server error", async () => {
    const getHostMetrics = vi.fn();
    const controller = new MetricsController({ getHostMetrics } as never);

    await expect(controller.getHostMetrics(org, { from: "a", to: "b" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getHostMetrics(org, { projectId: "" })).rejects.toBeInstanceOf(BadRequestException);
    expect(getHostMetrics).not.toHaveBeenCalled();
  });

  it("passes the project through", async () => {
    const getHostMetrics = vi.fn().mockResolvedValue({ buckets: [] });
    const controller = new MetricsController({ getHostMetrics } as never);

    await controller.getHostMetrics(org, { projectId: "p1", interval: "1m" });

    expect(getHostMetrics).toHaveBeenCalledWith("org-1", { projectId: "p1", interval: "1m" });
  });
});
