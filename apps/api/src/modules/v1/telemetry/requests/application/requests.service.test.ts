import { describe, expect, it, vi } from "vitest";
import { RequestsService } from "./requests.service";
import type { RequestStat } from "../domain/requests.repository.types";

const stat = (over: Partial<RequestStat>): RequestStat => ({ url: "/orders/1", method: "GET", count: 100, p50: 50, p95: 100, p99: 150, errorRate: 0, ...over });

describe("RequestsService.getEndpointHealth", () => {
  it("compares the window with the one before it and folds ids into one route", async () => {
    const queryStats = vi.fn(async ({ from }: { from: string }) =>
      from === "2026-11-19T00:00:00.000Z" ? [stat({ p95: 100 })] : [stat({ url: "/orders/1", p95: 400, count: 50 }), stat({ url: "/orders/2", p95: 400, count: 50 })],
    );
    const service = new RequestsService({ queryStats } as never);
    const result = await service.getEndpointHealth("org", { projectId: "p", from: "2026-11-20T00:00:00.000Z", to: "2026-11-21T00:00:00.000Z" });

    expect(queryStats).toHaveBeenCalledTimes(2);
    expect(queryStats.mock.calls.map(([args]) => args.from).sort()).toEqual(["2026-11-19T00:00:00.000Z", "2026-11-20T00:00:00.000Z"]);
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0]).toMatchObject({ url: "/orders/:id", count: 100, p95: 400, trend: { status: "regressing", p95ChangePct: 300 } });
  });

  it("defaults to the last 24 hours", async () => {
    const queryStats = vi.fn(async () => []);
    const result = await new RequestsService({ queryStats } as never).getEndpointHealth("org", { projectId: "p" });
    expect(Date.parse(result.to) - Date.parse(result.from)).toBe(24 * 60 * 60 * 1000);
    expect(result.score).toBeNull();
  });
});
