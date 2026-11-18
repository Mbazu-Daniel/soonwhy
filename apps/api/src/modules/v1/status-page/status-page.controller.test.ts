import { describe, expect, it, vi } from "vitest";
import { StatusPageController } from "./status-page.controller";

vi.mock("./resolve-status-target", () => ({
  resolveStatusTarget: vi.fn().mockResolvedValue({ orgId: "org", projectId: "project" }),
}));

const probe = (id: number) => ({ id, name: `p${id}`, url: "https://e.com", enabled: true, lastCheckAt: null, lastStatus: "up" });
const result = (probeId: number, status: string, minute: number) => ({ id: minute, probeId, status, checkedAt: new Date(Date.UTC(2026, 0, 1, 0, minute)) });

describe("StatusPageController.getStatus", () => {
  it("loads the recent results of all probes with one query", async () => {
    const getRecentResultsForProbes = vi.fn().mockResolvedValue(
      new Map([
        [1, [result(1, "up", 3), result(1, "down", 2), result(1, "up", 1)]],
        [2, [result(2, "up", 1)]],
      ]),
    );
    const repository = {
      getProbes: vi.fn().mockResolvedValue([probe(1), probe(2), probe(3)]),
      getRecentResultsForProbes,
      getProbeResults: vi.fn(),
    };
    const service = { withFreshStatus: (p: { lastStatus: string }) => p };
    const controller = new StatusPageController(service as never, repository as never);

    const page = (await controller.getStatus("org", "project")) as { services: Array<{ totalChecks: number; failedChecks: number }> };

    expect(getRecentResultsForProbes).toHaveBeenCalledTimes(1);
    expect(getRecentResultsForProbes).toHaveBeenCalledWith([1, 2, 3], 100);
    expect(repository.getProbeResults).not.toHaveBeenCalled();
    expect(page.services.map((s) => [s.totalChecks, s.failedChecks])).toEqual([[3, 1], [1, 0], [0, 0]]);
  });

  it("does not expose the probe URL on the public page", async () => {
    const repository = {
      getProbes: vi.fn().mockResolvedValue([{ ...probe(1), url: "https://internal.example/health?token=secret" }]),
      getRecentResultsForProbes: vi.fn().mockResolvedValue(new Map()),
    };
    const service = { withFreshStatus: (p: { lastStatus: string }) => p };
    const controller = new StatusPageController(service as never, repository as never);

    const page = await controller.getStatus("org", "project");

    expect(JSON.stringify(page)).not.toContain("internal.example");
  });
});
