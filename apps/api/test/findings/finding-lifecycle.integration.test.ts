import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/common/db";
import { findings } from "../../src/common/db/schema";
import { FindingRepository } from "../../src/modules/v1/detection/findings/infrastructure/finding.repository";
import { upsertFinding } from "../../src/modules/v1/detection/findings/infrastructure/finding-upsert";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const hour = 3_600_000;

describe.skipIf(!databaseTestsEnabled)("finding lifecycle", () => {
  const repository = new FindingRepository();
  const at = new Date("2026-05-01T12:00:00.000Z");
  let base: typeof findings.$inferInsert;

  beforeEach(async () => {
    await resetDatabase();
    const organization = await createOrganization();
    const project = await createProject(organization!.id);
    base = {
      orgId: organization!.id,
      projectId: project!.id,
      serviceName: "api",
      type: "latency",
      severity: "warning",
      title: "Slow",
      description: "Slow",
      observedValue: 900,
      threshold: 500,
      unit: "ms",
      windowStart: at,
      windowEnd: at,
      evidence: [],
      fingerprint: "latency:api:",
    };
  });
  afterAll(closeDatabase);

  it("updates one row when the same problem is detected again", async () => {
    const first = await upsertFinding(base, at);
    const second = await upsertFinding({ ...base, observedValue: 1200 }, new Date(at.getTime() + hour));

    expect(second!.id).toBe(first!.id);
    expect(second!.occurrences).toBe(2);
    expect(second!.observedValue).toBe(1200);
    expect(await db.select().from(findings)).toHaveLength(1);
  });

  it("counts one occurrence per detection run, not one per emitted finding", async () => {
    await upsertFinding(base, at);
    for (let index = 1; index <= 5; index += 1) await upsertFinding(base, new Date(at.getTime() + index * 1000));
    expect((await db.select().from(findings))[0]!.occurrences).toBe(1);

    await upsertFinding(base, new Date(at.getTime() + hour));
    expect((await db.select().from(findings))[0]!.occurrences).toBe(2);
  });

  it("keeps a resolved finding resolved until the problem is seen after it was resolved", async () => {
    const first = await upsertFinding(base, at);
    await repository.setStatus(base.orgId, base.projectId, first!.id, "resolved", null);

    const stale = await upsertFinding(base, new Date(at.getTime() - hour));
    expect(stale!.status).toBe("resolved");

    const recurred = await upsertFinding(base, new Date(Date.now() + hour));
    expect(recurred!.status).toBe("open");
    expect(recurred!.resolvedAt).toBeNull();
  });

  it("does not reopen an ignored finding", async () => {
    const first = await upsertFinding(base, at);
    await repository.setStatus(base.orgId, base.projectId, first!.id, "ignored", null);

    const again = await upsertFinding(base, new Date(Date.now() + hour));
    expect(again!.status).toBe("ignored");
  });

  it("records when a finding was resolved and clears it on reopen", async () => {
    const first = await upsertFinding(base, at);
    const resolved = await repository.setStatus(base.orgId, base.projectId, first!.id, "resolved", null);
    expect(resolved!.resolvedAt).toBeInstanceOf(Date);

    const reopened = await repository.setStatus(base.orgId, base.projectId, first!.id, "open", null);
    expect(reopened!.resolvedAt).toBeNull();
    expect((await db.select().from(findings).where(eq(findings.id, first!.id)))[0]!.status).toBe("open");
  });

  it("does not let another organization change a finding", async () => {
    const first = await upsertFinding(base, at);
    expect(await repository.setStatus("someone-else", base.projectId, first!.id, "resolved", null)).toBeUndefined();
  });

  it("counts findings by category, status and severity", async () => {
    await upsertFinding(base, at);
    await upsertFinding({ ...base, type: "error_group", category: "error", severity: "critical", fingerprint: "error_group:api:x" }, at);

    const rows = await repository.summary(base.orgId, base.projectId);
    expect(rows).toEqual(expect.arrayContaining([
      { category: "performance", status: "open", severity: "warning", count: 1 },
      { category: "error", status: "open", severity: "critical", count: 1 },
    ]));
  });

  it("builds a report from open findings and findings resolved in the period", async () => {
    const open = await upsertFinding(base, at);
    const done = await upsertFinding({ ...base, fingerprint: "latency:api:done" }, at);
    await repository.setStatus(base.orgId, base.projectId, done!.id, "resolved", null);
    const stale = await upsertFinding({ ...base, fingerprint: "latency:api:old", detectedAt: new Date("2020-01-01") }, new Date("2020-01-01"));
    await repository.setStatus(base.orgId, base.projectId, stale!.id, "ignored", null);

    const rows = await repository.reportRows(base.orgId, base.projectId, new Date(Date.now() - 7 * 86_400_000));
    expect(rows.map((row) => row.id).sort()).toEqual([open!.id, done!.id, stale!.id].sort());
  });
});
