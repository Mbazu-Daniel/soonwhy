import { describe, expect, it } from "vitest";
import {
  detectSlowRequests,
  detectThroughputDegradation,
} from "./slow-request-detector";

const requests = [
  { method: "GET", route: "/fast", durationMs: 50, timestamp: "2026-05-01T00:00:00.000Z" },
  { method: "GET", route: "/slow", durationMs: 1200, timestamp: "2026-05-01T00:00:01.000Z" },
  { method: "POST", route: "/critical", durationMs: 2500, timestamp: "2026-05-01T00:00:02.000Z" },
];

describe("detectSlowRequests", () => {
  it("returns findings only for requests over the threshold", () => {
    const findings = detectSlowRequests(requests, 1000);

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.severity)).toEqual(["warning", "critical"]);
    expect(findings[0]?.detectedAt).toBe("2026-05-01T00:00:01.000Z");
  });

  it("returns nothing when every request is within budget", () => {
    expect(detectSlowRequests([requests[0]!], 1000)).toEqual([]);
  });
});

describe("detectThroughputDegradation", () => {
  const baseline = { value: 100, samples: 30 };

  it("flags a warning for a material throughput drop", () => {
    const finding = detectThroughputDegradation(60, baseline, "GET", "/orders", "checkout");

    expect(finding).toMatchObject({
      severity: "warning",
      observedValue: 60,
      baselineValue: 100,
      changePercent: -40,
      serviceName: "checkout",
    });
  });

  it("escalates to critical at a fifty percent drop", () => {
    expect(detectThroughputDegradation(50, baseline, "GET", "/orders")?.severity).toBe("critical");
  });

  it("ignores small drops and healthy throughput", () => {
    expect(detectThroughputDegradation(80, baseline, "GET", "/orders")).toBeUndefined();
    expect(detectThroughputDegradation(120, baseline, "GET", "/orders")).toBeUndefined();
  });

  it("rejects invalid input and unusable baselines", () => {
    expect(detectThroughputDegradation(-1, baseline, "GET", "/orders")).toBeUndefined();
    expect(detectThroughputDegradation(10, { value: 0, samples: 30 }, "GET", "/orders")).toBeUndefined();
    expect(detectThroughputDegradation(10, { value: 100, samples: 2 }, "GET", "/orders")).toBeUndefined();
  });
});
