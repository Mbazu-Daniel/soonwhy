import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  buildStats,
  deterministicSummary,
  type SummaryContext,
} from "./summary-context";

const healthyOverview = {
  totalRequests: 12_400,
  errorRate: 0.4,
  avgLatency: 120,
  latencyP95: 300,
  latencyP99: 900,
  requestRate: 0.14,
};

const baseContext = (
  overrides: Partial<SummaryContext> = {},
): SummaryContext => ({
  overview: healthyOverview,
  findings: [],
  openIncidents: 0,
  ...overrides,
});

describe("buildStats", () => {
  it("buckets findings by severity and picks the most severe, most recent first", () => {
    const context = baseContext({
      findings: [
        { severity: "warning", title: "high latency", serviceName: "api", detectedAt: "2026-11-14T10:00:00.000Z" },
        { severity: "critical", title: "error spike", serviceName: "api", detectedAt: "2026-11-14T11:00:00.000Z" },
        { severity: "warning", title: "slow query", serviceName: "db", detectedAt: "2026-11-14T12:00:00.000Z" },
      ],
    });
    const stats = buildStats(context);
    expect(stats.critical).toBe(1);
    expect(stats.warning).toBe(2);
    expect(stats.totalFindings).toBe(3);
    expect(stats.topFinding).toBe("error spike (api)");
  });

  it("marks telemetry as missing when no requests arrived", () => {
    const stats = buildStats(
      baseContext({ overview: { ...healthyOverview, totalRequests: 0 } }),
    );
    expect(stats.hasTelemetry).toBe(false);
  });
});

describe("deterministicSummary", () => {
  it("says no telemetry arrived when the project is silent and empty", () => {
    const stats = buildStats(
      baseContext({ overview: { ...healthyOverview, totalRequests: 0 } }),
    );
    expect(deterministicSummary(stats)).toMatch(/No telemetry has arrived/);
  });

  it("states traffic, error rate and that nothing is on fire", () => {
    const stats = buildStats(baseContext());
    const summary = deterministicSummary(stats);
    expect(summary).toContain("12,400 requests");
    expect(summary).toContain("0.4%");
    expect(summary).toContain("No new findings");
    expect(summary).toContain("No incidents");
  });

  it("includes findings and incidents when present", () => {
    const stats = buildStats(
      baseContext({
        findings: [
          { severity: "critical", title: "error spike", serviceName: "api", detectedAt: "2026-11-14T10:00:00.000Z" },
        ],
        openIncidents: 2,
      }),
    );
    const summary = deterministicSummary(stats);
    expect(summary).toContain("1 finding");
    expect(summary).toContain("1 critical");
    expect(summary).toContain("error spike (api)");
    expect(summary).toContain("2 incidents");
  });
});

describe("buildPrompt", () => {
  it("includes the numbers and the top finding but no markdown fences", () => {
    const stats = buildStats(
      baseContext({
        findings: [
          { severity: "critical", title: "error spike", serviceName: "api", detectedAt: "2026-11-14T10:00:00.000Z" },
        ],
        openIncidents: 1,
      }),
    );
    const prompt = buildPrompt(stats);
    expect(prompt).toContain("Requests: 12400");
    expect(prompt).toContain("Findings in window: 1 (1 critical");
    expect(prompt).toContain("error spike (api)");
    expect(prompt).toContain("Open incidents");
  });
});
