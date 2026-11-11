import { describe, expect, it } from "vitest";
import { aggregateErrors, detectErrorRegression } from "./error-aggregator";
import type { ErrorOccurrence } from "./error-intelligence.types";

describe("ErrorAggregator", () => {
  describe("aggregateErrors", () => {
    it("aggregates error occurrences into summary statistics", () => {
      const occurrences: ErrorOccurrence[] = [
        {
          timestamp: "2026-01-01T00:00:00Z",
          errorFingerprint: "fp-123",
          errorType: "TypeError",
          errorMessage: "Cannot read properties of undefined",
          serviceName: "checkout",
          endpoint: "POST /checkout",
          userId: "user-1",
          deploymentId: "deploy-123",
          traceId: "trace-1",
        },
        {
          timestamp: "2026-01-01T00:01:00Z",
          errorFingerprint: "fp-123",
          errorType: "TypeError",
          errorMessage: "Cannot read properties of undefined",
          serviceName: "checkout",
          endpoint: "POST /checkout",
          userId: "user-2",
          deploymentId: "deploy-123",
          traceId: "trace-2",
        },
      ];

      const aggregation = aggregateErrors(occurrences);

      expect(aggregation.errorFingerprint).toBe("fp-123");
      expect(aggregation.occurrenceCount).toBe(2);
      expect(aggregation.affectedUsers).toBe(2);
      expect(aggregation.affectedEndpoints).toContain("POST /checkout");
      expect(aggregation.affectedServices).toContain("checkout");
    });

    it("throws on empty occurrences", () => {
      expect(() => aggregateErrors([])).toThrow("Cannot aggregate empty occurrences");
    });
  });

  describe("detectErrorRegression", () => {
    it("detects regression when error rate increases significantly", () => {
      const baseline = {
        errorFingerprint: "fp-123",
        errorType: "TypeError",
        errorMessage: "Cannot read properties of undefined",
        occurrenceCount: 100,
        affectedUsers: 10,
        affectedEndpoints: ["POST /checkout"],
        affectedServices: ["checkout"],
        affectedDeployments: ["deploy-123"],
        firstSeenAt: "2026-01-01T00:00:00Z",
        lastSeenAt: "2026-01-01T00:15:00Z",
        errorRate: 0.01,
      };
      const current = {
        errorFingerprint: "fp-123",
        errorType: "TypeError",
        errorMessage: "Cannot read properties of undefined",
        occurrenceCount: 500,
        affectedUsers: 50,
        affectedEndpoints: ["POST /checkout"],
        affectedServices: ["checkout"],
        affectedDeployments: ["deploy-123"],
        firstSeenAt: "2026-01-01T01:00:00Z",
        lastSeenAt: "2026-01-01T01:15:00Z",
        errorRate: 0.05,
      };

      const regression = detectErrorRegression(current, baseline, 2.0, 1.5);

      expect(regression).toBeDefined();
      expect(regression?.severity).toBe("critical");
    });

    it("does not detect regression when error rate is stable", () => {
      const baseline = {
        errorFingerprint: "fp-123",
        errorType: "TypeError",
        errorMessage: "Cannot read properties of undefined",
        occurrenceCount: 100,
        affectedUsers: 10,
        affectedEndpoints: ["POST /checkout"],
        affectedServices: ["checkout"],
        affectedDeployments: ["deploy-123"],
        firstSeenAt: "2026-01-01T00:00:00Z",
        lastSeenAt: "2026-01-01T00:15:00Z",
        errorRate: 0.01,
      };
      const current = {
        errorFingerprint: "fp-123",
        errorType: "TypeError",
        errorMessage: "Cannot read properties of undefined",
        occurrenceCount: 110,
        affectedUsers: 11,
        affectedEndpoints: ["POST /checkout"],
        affectedServices: ["checkout"],
        affectedDeployments: ["deploy-123"],
        firstSeenAt: "2026-01-01T01:00:00Z",
        lastSeenAt: "2026-01-01T01:15:00Z",
        errorRate: 0.011,
      };

      const regression = detectErrorRegression(current, baseline, 2.0, 1.5);

      expect(regression).toBeUndefined();
    });
  });
});
