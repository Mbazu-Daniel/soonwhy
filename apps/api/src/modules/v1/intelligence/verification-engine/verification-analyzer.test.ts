import { describe, expect, it } from "vitest";
import {
  verifyChange,
  checkRegression,
  verifyRecommendation,
} from "./verification-analyzer";
import type { VerificationRequest, MetricSnapshot } from "./verification-engine.types";

describe("VerificationAnalyzer", () => {
  describe("verifyChange", () => {
    it("detects improvement when metrics decrease", () => {
      const request: VerificationRequest = {
        changeId: "deploy-123",
        changeType: "deployment",
        beforeMetrics: {
          timestamp: "2026-01-01T00:00:00Z",
          metrics: { latency_p95: 2000, error_rate: 0.05 },
          count: 100,
        },
        afterMetrics: {
          timestamp: "2026-01-01T01:00:00Z",
          metrics: { latency_p95: 500, error_rate: 0.01 },
          count: 100,
        },
        timeWindow: {
          beforeStart: "2026-01-01T00:00:00Z",
          beforeEnd: "2026-01-01T00:15:00Z",
          afterStart: "2026-01-01T01:00:00Z",
          afterEnd: "2026-01-01T01:15:00Z",
        },
      };

      const result = verifyChange(request);

      // Status depends on overall score - check score instead
      expect(result.overallScore).toBeGreaterThanOrEqual(50);
      expect(result.summary.improved).toBe(2);
    });

    it("detects regression when metrics degrade", () => {
      const request: VerificationRequest = {
        changeId: "deploy-123",
        changeType: "deployment",
        beforeMetrics: {
          timestamp: "2026-01-01T00:00:00Z",
          metrics: { latency_p95: 500, error_rate: 0.01 },
          count: 100,
        },
        afterMetrics: {
          timestamp: "2026-01-01T01:00:00Z",
          metrics: { latency_p95: 2000, error_rate: 0.05 },
          count: 100,
        },
        timeWindow: {
          beforeStart: "2026-01-01T00:00:00Z",
          beforeEnd: "2026-01-01T00:15:00Z",
          afterStart: "2026-01-01T01:00:00Z",
          afterEnd: "2026-01-01T01:15:00Z",
        },
      };

      const result = verifyChange(request);

      // Check for degradation in summary
      expect(result.summary.degraded).toBe(2);
      // Degraded metrics without explicit expectations are warnings, not failures
      expect(result.summary.warned).toBeGreaterThan(0);
    });
  });

  describe("checkRegression", () => {
    it("detects regression when metric exceeds threshold", () => {
      const check = checkRegression("latency_p95", 500, 1000, 0.2);

      expect(check.isRegression).toBe(true);
      expect(check.changePercent).toBe(100);
      // 100% change exceeds 20% threshold * 3 = 60%, so critical
      expect(check.severity).toBe("critical");
    });

    it("does not detect regression when within threshold", () => {
      const check = checkRegression("latency_p95", 500, 550, 0.2);

      expect(check.isRegression).toBe(false);
      expect(check.changePercent).toBe(10);
    });

    it("assigns critical severity for large regressions", () => {
      const check = checkRegression("latency_p95", 500, 2000, 0.2);

      expect(check.isRegression).toBe(true);
      expect(check.severity).toBe("critical");
    });
  });

  describe("verifyRecommendation", () => {
    it("verifies recommendation achieved expected improvement", () => {
      const verification = verifyRecommendation(
        "rec-123",
        {
          metric: "latency_p95",
          before: "2000ms",
          after: "500ms",
          improvement: "75% reduction",
        },
        2000,
        500,
      );

      expect(verification.achieved).toBe(true);
      expect(verification.matchPercent).toBeGreaterThan(50);
    });

    it("fails recommendation when improvement not achieved", () => {
      const verification = verifyRecommendation(
        "rec-123",
        {
          metric: "latency_p95",
          before: "2000ms",
          after: "500ms",
          improvement: "75% reduction",
        },
        2000,
        1500,
      );

      expect(verification.achieved).toBe(false);
    });
  });
});
