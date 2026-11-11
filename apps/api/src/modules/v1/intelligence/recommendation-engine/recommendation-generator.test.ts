import { describe, expect, it } from "vitest";
import { generateRecommendations } from "./recommendation-generator";
import type { Finding } from "./recommendation-engine.types";
import { createTelemetryIdentity } from "@soonwhy/shared";

describe("RecommendationGenerator", () => {
  it("generates dependency recommendations for latency findings", () => {
    const findings: Finding[] = [
      {
        identity: createTelemetryIdentity({
          domain: "dependency",
          serviceName: "checkout",
          operationName: "http",
        }),
        findingType: "dependency_latency",
        severity: "warning",
        evidence: ["500ms latency", "payment-api"],
        confidence: 0.85,
      },
    ];

    const recommendations = generateRecommendations(findings);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.category).toBe("dependency");
    expect(recommendations[0]?.title).toContain("caching");
  });

  it("infers high priority from warning severity with high confidence", () => {
    const findings: Finding[] = [
      {
        identity: createTelemetryIdentity({
          domain: "dependency",
          serviceName: "checkout",
          operationName: "http",
        }),
        findingType: "dependency_latency",
        severity: "warning",
        evidence: ["500ms latency"],
        confidence: 0.9,
      },
    ];

    const recommendations = generateRecommendations(findings);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.priority).toBe("high");
  });
});
