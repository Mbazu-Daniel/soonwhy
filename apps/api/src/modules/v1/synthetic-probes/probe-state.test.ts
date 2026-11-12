import { describe, expect, it } from "vitest";
import { computeProbeStatus, isProbeStale } from "./probe-state";

describe("computeProbeStatus", () => {
  it("stays unknown until two consecutive successes", () => {
    expect(computeProbeStatus(["up"], "unknown")).toBe("unknown");
    expect(computeProbeStatus(["up", "up"], "unknown")).toBe("up");
  });

  it("opens after two consecutive failures", () => {
    expect(computeProbeStatus(["down"], "up")).toBe("up");
    expect(computeProbeStatus(["down", "down"], "up")).toBe("down");
  });

  it("recovers after two consecutive successes", () => {
    expect(computeProbeStatus(["up"], "down")).toBe("down");
    expect(computeProbeStatus(["up", "up"], "down")).toBe("up");
  });

  it("treats degraded as a failure for opening", () => {
    expect(computeProbeStatus(["degraded"], "up")).toBe("up");
    expect(computeProbeStatus(["degraded", "degraded"], "up")).toBe("down");
  });

  it("keeps current status while streaks are mixed", () => {
    expect(computeProbeStatus(["up", "down"], "down")).toBe("down");
    expect(computeProbeStatus(["down", "up", "down"], "up")).toBe("up");
  });

  it("defaults to unknown for fresh probes", () => {
    expect(computeProbeStatus([], null)).toBe("unknown");
  });
});

describe("isProbeStale", () => {
  it("flags missing checks as stale", () => {
    expect(isProbeStale(null, 60)).toBe(true);
  });

  it("flags checks older than three intervals or three minutes", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    expect(isProbeStale(new Date("2026-01-01T00:00:00Z"), 60, now)).toBe(true);
    expect(isProbeStale(new Date("2026-01-01T00:08:00Z"), 60, now)).toBe(false);
    expect(isProbeStale(new Date("2026-01-01T00:00:00Z"), 300, now)).toBe(false);
  });
});
