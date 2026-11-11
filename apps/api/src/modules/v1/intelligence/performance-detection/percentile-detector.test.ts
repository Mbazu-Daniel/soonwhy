import { describe, expect, it } from "vitest";
import {
  calculatePercentiles,
  detectPercentileDegradation,
} from "./percentile-detector";

const baseline = { p50: 100, p95: 200, p99: 400, samples: 100 };

describe("detectPercentileDegradation", () => {
  it("ignores missing or under-sampled baselines", () => {
    expect(detectPercentileDegradation({ p50: 100, p95: 400, p99: 800 }, undefined, "GET", "/")).toBeUndefined();
    expect(
      detectPercentileDegradation(
        { p50: 100, p95: 400, p99: 800 },
        { ...baseline, samples: 5 },
        "GET",
        "/",
      ),
    ).toBeUndefined();
  });

  it("flags doubling p95 tail latency as critical", () => {
    const finding = detectPercentileDegradation(
      { p50: 120, p95: 400, p99: 900 },
      baseline,
      "GET",
      "/orders",
      "checkout",
    );

    expect(finding).toMatchObject({
      severity: "critical",
      percentile: "p95",
      observedValue: 400,
      baselineValue: 200,
      serviceName: "checkout",
    });
  });

  it("keeps a fifty percent p95 increase at warning severity", () => {
    const finding = detectPercentileDegradation(
      { p50: 100, p95: 300, p99: 500 },
      { ...baseline, samples: 100, p95: 200 },
      "GET",
      "/orders",
    );

    expect(finding?.severity).toBe("warning");
  });

  it("ignores stable distributions", () => {
    expect(
      detectPercentileDegradation({ p50: 100, p95: 220, p99: 420 }, baseline, "GET", "/"),
    ).toBeUndefined();
  });
});

describe("calculatePercentiles", () => {
  it("returns zeroes for an empty sample", () => {
    expect(calculatePercentiles([])).toEqual({ p50: 0, p95: 0, p99: 0 });
  });

  it("sorts samples before selecting percentiles", () => {
    expect(calculatePercentiles([900, 100, 500, 300, 700])).toEqual({
      p50: 500,
      p95: 900,
      p99: 900,
    });
  });
});
