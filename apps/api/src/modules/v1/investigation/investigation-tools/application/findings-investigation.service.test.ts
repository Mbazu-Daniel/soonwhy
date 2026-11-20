import { describe, expect, it, vi } from "vitest";
import { FindingsInvestigation } from "./findings-investigation.service";

const row = {
  id: "f1",
  type: "error_group",
  category: "error",
  status: "resolved",
  severity: "critical",
  description: "d",
  observedValue: 1,
  threshold: 1,
  unit: "errors",
  windowStart: new Date(0),
  windowEnd: new Date(0),
  detectedAt: new Date(0),
  evidence: [],
};

describe("FindingsInvestigation", () => {
  it("shows each finding's status and category, so an assistant can see what it changed", async () => {
    const service = new FindingsInvestigation({ list: vi.fn().mockResolvedValue([row]) } as never);
    const result = await service.list({ orgId: "o", projectId: "p" }, { limit: 20 });
    expect(result.data?.[0]).toMatchObject({ id: "f1", status: "resolved", category: "error" });
  });
});
