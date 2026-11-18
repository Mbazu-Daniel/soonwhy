import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbCalls, useFakeDb } from "../../../../common/testing/fake-db";
import { DedupService } from "./dedup.service";

vi.mock("../../../../common/db", async () => {
  const { delegatingDb } = await import("../../../../common/testing/fake-db");
  return { db: delegatingDb };
});

const TRIGGERED_AT = new Date("2026-11-17T12:00:00.000Z");

describe("DedupService.shouldDedupe", () => {
  const service = new DedupService();

  beforeEach(() => {
    useFakeDb();
  });

  it("does not dedupe for a rule that does not exist, and claims nothing", async () => {
    useFakeDb({ select: [[]] });
    await expect(service.shouldDedupe("org", "project", "rule", TRIGGERED_AT, "High latency")).resolves.toEqual({ isDedupe: false });
    expect(dbCalls("insert")).toHaveLength(0);
  });

  it("lets the first trigger through when it wins the claim", async () => {
    useFakeDb({ select: [[{ dedupeWindowSeconds: 600 }]], insert: [[{ id: "t1" }]] });
    await expect(service.shouldDedupe("org", "project", "rule", TRIGGERED_AT, "High latency")).resolves.toEqual({ isDedupe: false });
    expect(dbCalls("select")).toHaveLength(1);
  });

  it("dedupes a trigger that loses the claim and returns the last trigger time", async () => {
    const lastTriggered = new Date("2026-11-17T11:58:00.000Z");
    useFakeDb({ select: [[{ dedupeWindowSeconds: 600 }], [{ triggeredAt: lastTriggered }]], insert: [[]] });
    await expect(service.shouldDedupe("org", "project", "rule", TRIGGERED_AT, "High latency")).resolves.toEqual({
      isDedupe: true,
      lastTriggered,
    });
  });

  it("dedupes without a last trigger time when the earlier trigger is outside the window", async () => {
    useFakeDb({ select: [[{ dedupeWindowSeconds: null }], []], insert: [[]] });
    await expect(service.shouldDedupe("org", "project", "rule", TRIGGERED_AT, "High latency")).resolves.toEqual({
      isDedupe: true,
      lastTriggered: undefined,
    });
  });
});
