import { describe, expect, it, vi } from "vitest";
import { servicesSeenWithin, telemetryStateOf } from "./service-activity";

describe("telemetryStateOf", () => {
  const active = new Set(["api"]);
  const recent = new Set(["api", "worker"]);

  it("is active when seen in the short window", () => {
    expect(telemetryStateOf("api", active, recent)).toBe("active");
  });

  it("is stale when only seen in the longer window", () => {
    expect(telemetryStateOf("worker", active, recent)).toBe("stale");
  });

  it("is none when never seen recently", () => {
    expect(telemetryStateOf("cron", active, recent)).toBe("none");
  });
});

describe("servicesSeenWithin", () => {
  it("collects service names from every index and survives one failing", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [{ key: "api" }] } } })
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [{ key: "worker" }, { key: " " }] } } });
    const seen = await servicesSeenWithin({ search } as never, "org-1", "project-1", 60_000, 1_000_000);
    expect([...seen].sort()).toEqual(["api", "worker"]);
    expect(search).toHaveBeenCalledTimes(3);
  });
});
