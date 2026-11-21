import { describe, expect, it } from "vitest";
import { buildDependencyMap, buildRankingInputs, criticalPathSpanIds, isErrorSpan } from "./root-cause.inputs";
import type { SpanRecord } from "./root-cause.inputs.types";

const span = (over: Partial<SpanRecord> & Pick<SpanRecord, "spanId" | "service">): SpanRecord => ({
  traceId: "t1",
  name: `${over.service} handle`,
  duration: 100,
  timestamp: new Date(1_000).toISOString(),
  parentSpanId: "",
  ...over,
});

const at = (ms: number) => new Date(1_000 + ms).toISOString();

const trace: SpanRecord[] = [
  span({ spanId: "g", service: "gateway", duration: 1000 }),
  span({ spanId: "o", service: "orders", parentSpanId: "g", duration: 900, timestamp: at(50) }),
  span({ spanId: "i", service: "inventory", parentSpanId: "o", duration: 200, timestamp: at(100) }),
  span({ spanId: "p", service: "payments", parentSpanId: "o", duration: 800, timestamp: at(100), statusCode: 2, statusMessage: "card declined" }),
];

describe("root-cause ranking inputs", () => {
  it("derives callers and callees from cross-service parent links", () => {
    const map = buildDependencyMap([trace]);
    expect(map.get("orders")).toEqual({ upstream: expect.arrayContaining(["inventory", "payments"]), downstream: ["gateway"] });
    expect(map.get("payments")).toEqual({ upstream: [], downstream: ["orders"] });
    expect(map.get("gateway")?.downstream).toEqual([]);
  });

  it("marks only the slowest parallel branch as critical", () => {
    const critical = criticalPathSpanIds(trace);
    expect(critical.has("p")).toBe(true);
    expect(critical.has("i")).toBe(false);
    expect(critical.has("g")).toBe(true);
  });

  it("turns error spans into error records with the span's own message", () => {
    const { errors } = buildRankingInputs([trace]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ serviceName: "payments", traceId: "t1", errorMessage: "card declined" });
  });

  it("recognises numeric and textual error status codes", () => {
    expect(isErrorSpan(span({ spanId: "a", service: "s", statusCode: 2 }))).toBe(true);
    expect(isErrorSpan(span({ spanId: "a", service: "s", statusCode: "STATUS_CODE_ERROR" }))).toBe(true);
    expect(isErrorSpan(span({ spanId: "a", service: "s", statusCode: 1 }))).toBe(false);
    expect(isErrorSpan(span({ spanId: "a", service: "s" }))).toBe(false);
  });

  it("skips empty traces and keeps spans in start-time milliseconds", () => {
    const { traces } = buildRankingInputs([[], trace]);
    expect(traces).toHaveLength(1);
    expect(traces[0]?.find((s) => s.spanId === "o")).toMatchObject({ serviceName: "orders", startTime: 1050, duration: 900, parentSpanId: "g" });
  });
});
