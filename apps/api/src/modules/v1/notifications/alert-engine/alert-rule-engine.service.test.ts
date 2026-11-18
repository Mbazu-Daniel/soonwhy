import { describe, expect, it, vi } from "vitest";
import { AlertRuleEngineService } from "./alert-rule-engine.service";
import type { AlertRuleCondition } from "./alert-rule-conditions";

vi.mock("../../../../common/db", async () => {
  const { delegatingDb } = await import("../../../../common/testing/fake-db");
  return { db: delegatingDb };
});

function condition(overrides: Partial<AlertRuleCondition>): AlertRuleCondition {
  return {
    type: "threshold",
    metric: "value",
    operator: "gt",
    value: 100,
    negate: false,
    ...overrides,
  };
}

const engine = new AlertRuleEngineService();

describe("AlertRuleEngineService threshold conditions", () => {
  it.each([
    ["gt", 101, 100, "satisfied"],
    ["gt", 100, 100, "not_satisfied"],
    ["gte", 100, 100, "satisfied"],
    ["gte", 99, 100, "not_satisfied"],
    ["lt", 99, 100, "satisfied"],
    ["lt", 100, 100, "not_satisfied"],
    ["lte", 100, 100, "satisfied"],
    ["lte", 101, 100, "not_satisfied"],
    ["eq", 100, 100, "satisfied"],
    ["eq", 99, 100, "not_satisfied"],
    ["ne", 99, 100, "satisfied"],
    ["ne", 100, 100, "not_satisfied"],
  ] as const)("%s with metric %i against %i is %s", async (operator, metric, threshold, expected) => {
    const outcome = await engine.evaluateCondition(condition({ operator, value: threshold }), { value: metric });
    expect(outcome.result).toBe(expected);
  });

  it("reports the metric, threshold and operator that decided the result", async () => {
    const outcome = await engine.evaluateCondition(condition({ metric: "p95", operator: "gt", value: 500 }), { p95: 900 });
    expect(outcome.details).toMatchObject({ metric: "p95", metricValue: 900, threshold: 500, operator: "gt", satisfied: true, negated: false });
  });

  it("inverts the result when negate is set", async () => {
    const satisfied = await engine.evaluateCondition(condition({ negate: true }), { value: 50 });
    const unsatisfied = await engine.evaluateCondition(condition({ negate: true }), { value: 150 });
    expect(satisfied.result).toBe("satisfied");
    expect(unsatisfied.result).toBe("not_satisfied");
  });

  it("reads a nested metric by its dotted path", async () => {
    const outcome = await engine.evaluateCondition(condition({ metric: "http.latency.p95" }), { http: { latency: { p95: 250 } } });
    expect(outcome.result).toBe("satisfied");
    expect(outcome.details.metricValue).toBe(250);
  });

  it("reads a numeric string metric as a number", async () => {
    const outcome = await engine.evaluateCondition(condition({}), { value: "150.5" });
    expect(outcome.result).toBe("satisfied");
    expect(outcome.details.metricValue).toBe(150.5);
  });

  it("returns insufficient data when the metric is missing", async () => {
    const outcome = await engine.evaluateCondition(condition({ metric: "missing" }), { value: 500 });
    expect(outcome).toEqual({ result: "insufficient_data", details: { reason: "metric_not_found", metric: "missing" } });
  });

  it("returns insufficient data when a path crosses a null value", async () => {
    const outcome = await engine.evaluateCondition(condition({ metric: "a.b" }), { a: null });
    expect(outcome.result).toBe("insufficient_data");
  });

  it("returns insufficient data when the metric is not a number", async () => {
    const outcome = await engine.evaluateCondition(condition({}), { value: { nested: true } });
    expect(outcome.result).toBe("insufficient_data");
  });

  it("does not satisfy an operator it does not implement", async () => {
    const outcome = await engine.evaluateCondition(condition({ operator: "crosses" }), { value: 500 });
    expect(outcome.result).toBe("not_satisfied");
  });

  it("does not satisfy a comparison against a metric that is not a number", async () => {
    const outcome = await engine.evaluateCondition(condition({ operator: "gt" }), { value: "not-a-number" });
    expect(outcome.result).toBe("not_satisfied");
  });
});

describe("AlertRuleEngineService rate conditions", () => {
  it("requires a window", async () => {
    const outcome = await engine.evaluateCondition(condition({ type: "rate" }), { value: 5 });
    expect(outcome).toEqual({ result: "insufficient_data", details: { reason: "rate_window_required" } });
  });

  it("compares the metric with the threshold inside the window", async () => {
    const at = new Date("2026-11-17T12:00:00.000Z");
    const outcome = await engine.evaluateCondition(condition({ type: "rate", window: "5m", operator: "gt", value: 10 }), { value: 12 }, at);
    expect(outcome.result).toBe("satisfied");
    expect(outcome.details).toMatchObject({ rate: 12, operator: "gt", satisfied: true });
    expect(typeof outcome.details.window_start).toBe("string");
    expect(typeof outcome.details.window_end).toBe("string");
  });

  it("returns insufficient data when the metric is missing", async () => {
    const outcome = await engine.evaluateCondition(condition({ type: "rate", window: "5m", metric: "missing" }), {});
    expect(outcome.result).toBe("insufficient_data");
  });

  it("honours negate", async () => {
    const outcome = await engine.evaluateCondition(condition({ type: "rate", window: "5m", negate: true, value: 10 }), { value: 12 });
    expect(outcome.result).toBe("not_satisfied");
  });
});

describe("AlertRuleEngineService other conditions", () => {
  it("returns insufficient data for an expression with nothing to evaluate", async () => {
    const outcome = await engine.evaluateCondition(condition({ type: "expression" }), {});
    expect(outcome).toEqual({ result: "insufficient_data", details: { reason: "no_conditions_to_evaluate" } });
  });

  it("counts the sub conditions of an expression", async () => {
    const outcome = await engine.evaluateCondition(condition({ type: "expression", dependsOn: ["a", "b"] }), {});
    expect(outcome.result).toBe("satisfied");
    expect(outcome.details.sub_conditions_evaluated).toBe(2);
  });

  it.each(["anomaly", "lookup"] as const)("returns insufficient data for the %s type, which is not evaluated here", async (type) => {
    const outcome = await engine.evaluateCondition(condition({ type }), { value: 500 });
    expect(outcome).toEqual({ result: "insufficient_data", details: {} });
  });
});
