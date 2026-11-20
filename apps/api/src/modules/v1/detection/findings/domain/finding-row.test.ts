import { describe, expect, it } from "vitest";
import { findingRow } from "./finding-row";
import type { RaisedFinding } from "./finding-row.types";

const base: RaisedFinding = {
  orgId: "o", projectId: "p", serviceName: "api", type: "latency", severity: "warning", title: "t", description: "d",
  observedValue: 1, threshold: 2, unit: "ms", windowStart: new Date(0), windowEnd: new Date(1), evidence: [],
};

describe("findingRow", () => {
  it("fills category, fingerprint and recommendation from the finding type", () => {
    const row = findingRow({ ...base, key: "GET /a" });
    expect(row).toMatchObject({ category: "performance", fingerprint: "latency:api:GET /a" });
    expect(row.recommendation).toContain("slowest endpoints");
    expect(row).not.toHaveProperty("key");
  });

  it("lets the producer override the category and the recommendation", () => {
    expect(findingRow({ ...base, category: "security", recommendation: "Upgrade it." })).toMatchObject({ category: "security", recommendation: "Upgrade it." });
    expect(findingRow({ ...base, recommendation: null }).recommendation).toBeNull();
  });

  it("falls back for a type with no registered kind", () => {
    expect(findingRow({ ...base, type: "dependency_vulnerability" })).toMatchObject({ category: "performance", recommendation: null });
  });
});
