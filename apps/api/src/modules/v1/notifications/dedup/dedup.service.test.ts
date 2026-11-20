import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbCalls, useFakeDb } from "../../../../common/testing/fake-db";
import { DedupService } from "./dedup.service";

vi.mock("../../../../common/db", async () => {
  const { delegatingDb } = await import("../../../../common/testing/fake-db");
  return { db: delegatingDb };
});

const TRIGGERED_AT = new Date("2026-11-17T12:00:00.000Z");

const RULE = { id: "rule", name: "High latency" };
const assess = (service: DedupService) => service.assess("org", "project", RULE, TRIGGERED_AT);
const PROTECTED = [{ streakCount: 2, status: "active" }];
const UNPROTECTED = [{ streakCount: 1, status: "active" }];

describe("DedupService.assess", () => {
  const service = new DedupService();

  beforeEach(() => {
    useFakeDb();
  });

  it("does not dedupe for a rule that does not exist, and claims nothing", async () => {
    useFakeDb({ select: [[], []] });
    await expect(assess(service)).resolves.toEqual({ isDedupe: false, hasIncidentProtection: false });
    expect(dbCalls("insert")).toHaveLength(0);
  });

  it("lets the first trigger through, with no protection yet, when it wins the claim", async () => {
    useFakeDb({ select: [[{ dedupeWindowSeconds: 600 }], UNPROTECTED], insert: [[{ id: "t1" }]] });
    await expect(assess(service)).resolves.toEqual({ isDedupe: false, hasIncidentProtection: false });
  });

  it("counts a repeat of an undispatched trigger and reports protection once the streak reaches two", async () => {
    useFakeDb({ select: [[{ dedupeWindowSeconds: 600 }], PROTECTED], insert: [[]], update: [[{ metadata: {} }]] });
    await expect(assess(service)).resolves.toEqual({ isDedupe: false, hasIncidentProtection: true });
    expect(dbCalls("update")).toHaveLength(1);
  });

  it("dedupes while the last dispatch is inside the window", async () => {
    const dispatchedAt = new Date("2026-11-17T11:58:00.000Z").toISOString();
    useFakeDb({ select: [[{ dedupeWindowSeconds: 600 }], PROTECTED], insert: [[]], update: [[{ metadata: { dispatchedAt } }]] });
    await expect(assess(service)).resolves.toEqual({ isDedupe: true, hasIncidentProtection: true });
  });

  it("lets the alert through again once the last dispatch is outside the window", async () => {
    const dispatchedAt = new Date("2026-11-17T11:00:00.000Z").toISOString();
    useFakeDb({ select: [[{ dedupeWindowSeconds: 600 }], PROTECTED], insert: [[]], update: [[{ metadata: { dispatchedAt } }]] });
    await expect(assess(service)).resolves.toMatchObject({ isDedupe: false });
  });
});

describe("DedupService.recover", () => {
  const service = new DedupService();

  it("does nothing when the rule has no active trigger", async () => {
    useFakeDb({ select: [[]] });
    await expect(service.recover("rule")).resolves.toBe(false);
    expect(dbCalls("update")).toHaveLength(0);
  });

  it("resets the streak, marks it healthy and resolves the trigger", async () => {
    useFakeDb({
      select: [[{ id: "t1", streakCount: 3 }], [{ state: "firing", status: "active" }], [{ status: "active" }]],
      update: [[], [], []],
    });
    await expect(service.recover("rule")).resolves.toBe(true);
    expect(dbCalls("update")).toHaveLength(3);
  });
});
