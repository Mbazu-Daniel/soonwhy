import { describe, expect, it } from "vitest";
import {
  detectRuntimeDegradation,
  type RuntimeMetricSample,
} from "./runtime-degradation.detector";

function samples(
  name: string,
  values: number[],
  service = "checkout-api",
): RuntimeMetricSample[] {
  return values.map((value, index) => ({
    timestamp: `2026-09-20T18:0${index}:00.000Z`,
    service,
    name,
    value,
  }));
}

describe("detectRuntimeDegradation", () => {
  it("detects critical CPU saturation and preserves runtime identity", () => {
    const [candidate] = detectRuntimeDegradation(
      samples("process.cpu.utilization", [70, 88, 92, 97, 99, 96]),
    );

    expect(candidate).toMatchObject({
      serviceName: "checkout-api",
      metricName: "process.cpu.utilization",
      family: "cpu",
      signal: { severity: "critical", threshold: 0.95 },
    });
    expect(candidate?.identity.domain).toBe("runtime");
    expect(candidate?.identity.resourceName).toBe("process.cpu.utilization");
  });

  it("calibrates millisecond event loop delay into seconds", () => {
    const [candidate] = detectRuntimeDegradation(
      samples("nodejs.eventloop.delay.p95", [250, 180, 300, 210, 400, 120]),
    );

    expect(candidate).toMatchObject({ family: "event_loop_delay", unit: "s" });
    expect(candidate?.signal.p95).toBeLessThan(1);
    expect(candidate?.signal.severity).toBe("warning");
  });

  it("rejects sparse samples, healthy values, and unknown metrics", () => {
    expect(
      detectRuntimeDegradation(
        samples("process.cpu.utilization", [99, 99, 99, 99]),
      ),
    ).toEqual([]);
    expect(
      detectRuntimeDegradation(
        samples("process.memory.utilization", [0.4, 0.5, 0.6, 0.5, 0.45]),
      ),
    ).toEqual([]);
    expect(
      detectRuntimeDegradation(samples("custom.metric", [99, 99, 99, 99, 99])),
    ).toEqual([]);
  });

  it("records the baseline regression without gating on it", () => {
    const [candidate] = detectRuntimeDegradation(
      samples("process.memory.utilization", [0.92, 0.94, 0.93, 0.95, 0.96]),
      samples("process.memory.utilization", [0.5, 0.52, 0.51, 0.5, 0.53]),
    );

    expect(candidate?.signal.baselineP95).toBeGreaterThan(0);
    expect(candidate?.signal.p95ChangePercent).toBeGreaterThan(50);
  });
});
