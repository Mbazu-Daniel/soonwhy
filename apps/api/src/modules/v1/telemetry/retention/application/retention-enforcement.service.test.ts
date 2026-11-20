import { describe, expect, it, vi } from "vitest";
import { RetentionEnforcementService } from "./retention-enforcement.service";

function policy(id: number, lastCleanupAt: Date | null) {
  return {
    id,
    orgId: "org-1",
    projectId: "project-1",
    dataType: "logs",
    retentionDays: 30,
    autoCleanup: true,
    cleanupSchedule: "daily",
    lastCleanupAt,
    isActive: true,
  };
}

describe("RetentionEnforcementService", () => {
  it("enforces only policies whose interval has elapsed", async () => {
    const now = new Date("2026-11-05T04:00:00.000Z");
    const due = policy(1, null);
    const recentlyCleaned = policy(2, new Date("2026-11-04T20:00:00.000Z"));
    const policies = {
      getAllActivePolicies: vi.fn().mockResolvedValue([due, recentlyCleaned]),
      executePolicy: vi.fn().mockResolvedValue({ policyId: 1, success: true, skipped: false }),
    };
    const service = new RetentionEnforcementService(policies as never);

    const results = await service.enforceDuePolicies(now);

    expect(policies.executePolicy).toHaveBeenCalledTimes(1);
    expect(policies.executePolicy).toHaveBeenCalledWith(due, now);
    expect(results).toHaveLength(1);
  });
});
