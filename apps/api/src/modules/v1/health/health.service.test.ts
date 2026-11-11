import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../common/db", () => ({
  db: { execute: vi.fn() },
}));

import { db } from "../../../common/db";
import { HealthService } from "./health.service";

const cache = {
  health: vi.fn(),
};

beforeEach(() => {
  vi.mocked(cache.health).mockResolvedValue({ status: "ok", latencyMs: 1 });
  vi.mocked(db.execute).mockResolvedValue([] as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HealthService", () => {
  it("reports readiness when every dependency responds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const service = new HealthService(cache as never);

    const report = await service.readiness();

    expect(report.status).toBe("ok");
    expect(report.dependencies.database.status).toBe("ok");
    expect(report.dependencies.redis.status).toBe("ok");
    expect(report.dependencies.quickwit.status).toBe("ok");
  });

  it("degrades readiness when the database is unreachable", async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error("connection refused"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const service = new HealthService(cache as never);

    const report = await service.readiness();

    expect(report.status).toBe("degraded");
    expect(report.dependencies.database).toMatchObject({
      status: "unavailable",
      error: "connection refused",
    });
  });

  it("keeps readiness healthy when only an optional dependency fails", async () => {
    vi.mocked(cache.health).mockResolvedValue({
      status: "unavailable",
      latencyMs: 1,
      error: "redis down",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("quickwit down")));
    const service = new HealthService(cache as never);

    const report = await service.readiness();

    expect(report.status).toBe("ok");
    expect(report.dependencies.redis.status).toBe("unavailable");
    expect(report.dependencies.quickwit.status).toBe("unavailable");
  });

  it("reports a non-2xx quickwit response as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const service = new HealthService(cache as never);

    const result = await service.checkQuickwit();

    expect(result).toMatchObject({ status: "unavailable", error: "HTTP 503" });
  });
});
