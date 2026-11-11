import { describe, expect, it, vi } from "vitest";
import { RetentionPoliciesService } from "./retention-policies.service";
import { QUICKWIT_INDEXES } from "@soonwhy/shared";

vi.mock("../../../common/db", () => ({
  db: { update: vi.fn() },
}));

import { db } from "../../../common/db";

function policy(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: "org-1",
    projectId: "project-1",
    dataType: "logs",
    retentionDays: 30,
    maxStorageGb: null,
    autoCleanup: true,
    cleanupSchedule: "daily",
    lastCleanupAt: null,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function serviceWith(purgeByQuery: ReturnType<typeof vi.fn>) {
  return new RetentionPoliciesService({ purgeByQuery } as never);
}

describe("RetentionPoliciesService", () => {
  it("purges tenant data older than the policy cutoff", async () => {
    const purgeByQuery = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as never);
    const service = serviceWith(purgeByQuery);

    const result = await service.executePolicy(
      policy() as never,
      new Date("2026-11-05T00:00:00.000Z"),
    );

    expect(result).toMatchObject({ success: true, skipped: false });
    expect(purgeByQuery).toHaveBeenCalledWith(
      QUICKWIT_INDEXES.logs,
      expect.stringContaining('org_id:"org\\-1"'),
    );
    expect(purgeByQuery.mock.calls[0]?.[1]).toContain('project_id:"project\\-1"');
    expect(purgeByQuery.mock.calls[0]?.[1]).toContain("2026-10-06T00:00:00.000Z");
  });

  it("does not purge when automatic cleanup is disabled", async () => {
    const purgeByQuery = vi.fn();
    const service = serviceWith(purgeByQuery);

    const result = await service.executePolicy(policy({ autoCleanup: false }) as never);

    expect(result).toMatchObject({ success: true, skipped: true });
    expect(purgeByQuery).not.toHaveBeenCalled();
  });

  it("reports a failed purge without throwing", async () => {
    const purgeByQuery = vi.fn().mockRejectedValue(new Error("quickwit unavailable"));
    const service = serviceWith(purgeByQuery);

    const result = await service.executePolicy(policy() as never);

    expect(result).toMatchObject({
      success: false,
      skipped: false,
      error: "quickwit unavailable",
    });
  });
});
