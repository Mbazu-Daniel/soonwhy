import { describe, expect, it, vi } from "vitest";
import { MetricsRepository } from "../infrastructure/metrics.repository";

describe("MetricsRepository.countHostSamples", () => {
  it("counts host samples for the project in the window", async () => {
    const search = vi.fn().mockResolvedValue({ num_hits: 42, hits: [] });
    const repository = new MetricsRepository({ search } as never);
    const count = await repository.countHostSamples({
      orgId: "org-1",
      projectId: "proj-1",
      from: "2026-11-17T10:00:00.000Z",
      to: "2026-11-17T10:15:00.000Z",
    });
    expect(count).toBe(42);
    const [, input] = search.mock.calls[0]!;
    expect(input.query).toContain("org_id:");
    expect(input.query).toContain("project_id:");
    expect(input.query).toContain("system.cpu.utilization");
    expect(input.maxHits).toBe(0);
  });

  it("reports zero when nothing arrived", async () => {
    const repository = new MetricsRepository({ search: vi.fn().mockResolvedValue({ num_hits: 0, hits: [] }) } as never);
    await expect(repository.countHostSamples({ orgId: "org-1", projectId: "proj-1", from: "2026-11-17T10:00:00.000Z", to: "2026-11-17T10:15:00.000Z" })).resolves.toBe(0);
  });
});

describe("MetricsRepository.queryHostMetrics", () => {
  it("limits every host query to the project", async () => {
    const search = vi.fn().mockResolvedValue({ num_hits: 0, hits: [], aggregations: {} });
    const repository = new MetricsRepository({ search } as never);
    await repository.queryHostMetrics({ orgId: "org-1", projectId: "proj-1", from: "2026-11-17T10:00:00.000Z", to: "2026-11-17T11:00:00.000Z", interval: "1m" });
    expect(search).toHaveBeenCalledTimes(3);
    for (const [, input] of search.mock.calls) expect(input.query).toContain("project_id:");
  });
});
