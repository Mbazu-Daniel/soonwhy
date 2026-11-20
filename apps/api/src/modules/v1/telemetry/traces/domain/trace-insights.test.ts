import { describe, expect, it } from "vitest";
import { analyzeTraceInsights } from "./trace-insights";
import type { InsightSpan } from "./trace-insights.types";

const T0 = Date.parse("2026-11-20T10:00:00.000Z");
const span = (id: string, parent: string, name: string, startMs: number, duration: number, extra: Partial<InsightSpan> = {}): InsightSpan => ({
  spanId: id, parentSpanId: parent, name, service: "api", duration, timestamp: new Date(T0 + startMs).toISOString(), ...extra,
});

describe("analyzeTraceInsights", () => {
  it("returns nothing for an empty trace", () => {
    expect(analyzeTraceInsights([])).toEqual({ durationMs: 0, criticalPath: [], findings: [] });
  });

  it("walks the critical path and finds the span that holds most of the time", () => {
    const result = analyzeTraceInsights([
      span("r", "", "GET /report", 0, 1000),
      span("a", "r", "load rows", 10, 100),
      span("b", "r", "render pdf", 120, 850),
    ]);
    expect(result.durationMs).toBe(1000);
    expect(result.criticalPath.map((step) => step.name)).toEqual(["GET /report", "render pdf"]);
    expect(result.findings[0]).toMatchObject({ kind: "dominant_span", spanIds: ["b"] });
  });

  it("flags independent calls that run in a row and says how much parallel would save", () => {
    const result = analyzeTraceInsights([
      span("r", "", "GET /home", 0, 400),
      span("a", "r", "get user", 0, 100),
      span("b", "r", "get cart", 100, 100),
      span("c", "r", "get offers", 200, 100),
    ]);
    const finding = result.findings.find((item) => item.kind === "sequential_calls");
    expect(finding).toMatchObject({ impactMs: 200, spanIds: ["a", "b", "c"] });
  });

  it("does not flag calls that already overlap", () => {
    const result = analyzeTraceInsights([
      span("r", "", "GET /home", 0, 200),
      span("a", "r", "get user", 0, 100),
      span("b", "r", "get cart", 0, 100),
      span("c", "r", "get offers", 0, 100),
    ]);
    expect(result.findings.find((item) => item.kind === "sequential_calls")).toBeUndefined();
  });

  it("flags one call repeated many times", () => {
    const calls = Array.from({ length: 6 }, (_, i) => span(`c${i}`, "r", "GET inventory", i * 15, 12));
    const result = analyzeTraceInsights([span("r", "", "GET /cart", 0, 200), ...calls]);
    expect(result.findings.find((item) => item.kind === "repeated_calls")).toMatchObject({ impactMs: 72 });
  });

  it("points at the deepest failing span and its reason", () => {
    const result = analyzeTraceInsights([
      span("r", "", "POST /pay", 0, 300, { statusCode: 2 }),
      span("a", "r", "charge card", 10, 250, { statusCode: 2, exceptionMessage: "card declined" }),
    ]);
    expect(result.findings[0]).toMatchObject({ kind: "error_origin", spanIds: ["a"], severity: "critical" });
    expect(result.findings[0]!.detail).toContain("card declined");
  });

  it("calls out a slow leaf dependency", () => {
    const result = analyzeTraceInsights([
      span("r", "", "GET /feed", 0, 600),
      span("a", "r", "GET partner-api", 20, 500),
    ]);
    expect(result.findings.map((item) => item.kind)).toContain("slow_dependency");
  });
});
