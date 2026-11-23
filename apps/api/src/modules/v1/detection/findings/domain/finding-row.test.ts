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

  describe("error group recommendation", () => {
    const group = (title: string) => findingRow({ ...base, type: "error_group", title }).recommendation!;

    it("treats a client error as usually expected instead of asking for a code fix", () => {
      const text = group("HTTP 401 in mivacampus-api: GET /api/v1/me 401");
      expect(text).toMatch(/expired or missing session/i);
      expect(text).toMatch(/ignore/i);
      expect(text).not.toMatch(/stack frame/i);
    });

    it("names the likely meaning of other common client errors", () => {
      expect(group("HTTP 404 in api: GET /x 404")).toMatch(/not found|missing route|stale link/i);
      expect(group("HTTP 429 in api: POST /y 429")).toMatch(/rate limit/i);
      expect(group("HTTP 418 in api: GET /z 418")).toMatch(/client/i);
    });

    it("keeps the fix-the-code advice for server errors and for groups with no status", () => {
      expect(group("HTTP 500 in api: GET /x 500")).toMatch(/stack frame/i);
      expect(group("TypeError in api: checkout")).toMatch(/stack frame/i);
    });
  });
});
