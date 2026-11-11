import { describe, expect, it } from "vitest";
import {
  detectDatabaseTimeContribution,
  detectSpanContribution,
} from "./span-contribution-detector";

describe("detectSpanContribution", () => {
  it("flags a span that dominates trace duration", () => {
    const finding = detectSpanContribution(600, 1000, "db.query", "trace-1", "span-1", "checkout");

    expect(finding).toMatchObject({
      severity: "warning",
      observedValue: 60,
      unit: "%",
      spanName: "db.query",
      traceId: "trace-1",
    });
    expect(finding?.identity.serviceName).toBe("checkout");
  });

  it("escalates when the contribution passes the critical threshold", () => {
    expect(detectSpanContribution(800, 1000, "db.query")?.severity).toBe("critical");
  });

  it("ignores small contributions and impossible durations", () => {
    expect(detectSpanContribution(200, 1000, "db.query")).toBeUndefined();
    expect(detectSpanContribution(1200, 1000, "db.query")).toBeUndefined();
    expect(detectSpanContribution(0, 1000, "db.query")).toBeUndefined();
  });
});

describe("detectDatabaseTimeContribution", () => {
  it("flags traces dominated by database time", () => {
    const finding = detectDatabaseTimeContribution(800, 1000, "checkout");

    expect(finding).toMatchObject({
      severity: "critical",
      observedValue: 80,
      spanName: "database_operations",
    });
    expect(finding?.identity.serviceName).toBe("checkout");
  });

  it("returns nothing when database time is a minor share", () => {
    expect(detectDatabaseTimeContribution(200, 1000)).toBeUndefined();
  });
});
