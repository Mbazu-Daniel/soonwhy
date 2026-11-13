import { inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/common/db";
import {
  deadLetterQueue,
  detectionRuns,
  idempotencyKeys,
  ingestEventReceipts,
  notificationLogs,
} from "../../src/common/db/schema";
import { CleanupService, cutoff } from "../../src/common/maintenance/cleanup.service";
import { CLEANUP_RETENTION_DAYS } from "../../src/common/maintenance/cleanup.types";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

describe.skipIf(!databaseTestsEnabled)("CleanupService", () => {
  const service = new CleanupService();
  const now = new Date("2026-05-01T12:00:00.000Z");
  const expired = (days: number) => new Date(cutoff(now, days).getTime() - 1_000);

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("removes rows older than each retention window and keeps recent rows", async () => {
    const organization = await createOrganization();
    const project = await createProject(organization.id);

    const oldReceipt = { eventId: "receipt-old", organizationId: organization.id, projectId: project.id, signal: "log" };
    const newReceipt = { eventId: "receipt-new", organizationId: organization.id, projectId: project.id, signal: "log" };
    await db.insert(ingestEventReceipts).values([
      { ...oldReceipt, createdAt: expired(CLEANUP_RETENTION_DAYS.ingestReceipts) },
      { ...newReceipt, createdAt: now },
    ]);

    const oldLetter = { signal: "log", deliveryCount: 1, reason: "failed", payload: {}, failedAt: expired(CLEANUP_RETENTION_DAYS.deadLetters) };
    const newLetter = { signal: "log", deliveryCount: 1, reason: "failed", payload: {}, failedAt: now };
    await db.insert(deadLetterQueue).values([oldLetter, newLetter]);

    const oldNotification = {
      orgId: organization.id,
      projectId: project.id,
      channelType: "email" as const,
      idempotencyKey: "cleanup-old",
      createdAt: expired(CLEANUP_RETENTION_DAYS.notificationLogs),
    };
    const newNotification = {
      orgId: organization.id,
      projectId: project.id,
      channelType: "email" as const,
      idempotencyKey: "cleanup-new",
      createdAt: now,
    };
    await db.insert(notificationLogs).values([oldNotification, newNotification]);

    const oldRun = {
      orgId: organization.id,
      projectId: project.id,
      windowStart: now,
      windowEnd: now,
      status: "completed",
      startedAt: expired(CLEANUP_RETENTION_DAYS.detectionRuns),
    };
    const newRun = { ...oldRun, startedAt: now };
    await db.insert(detectionRuns).values([oldRun, newRun]);

    const oldKey = { keyHash: "hash-old", key: "key-old", fingerprint: "fp-old", expiresAt: now.getTime() - 1_000 };
    const newKey = { keyHash: "hash-new", key: "key-new", fingerprint: "fp-new", expiresAt: now.getTime() + 100_000 };
    await db.insert(idempotencyKeys).values([oldKey, newKey]);

    const report = await service.cleanup(now);

    expect(report.results).toEqual([
      { table: "ingest_event_receipts", deleted: 1 },
      { table: "dead_letter_queue", deleted: 1 },
      { table: "notification_logs", deleted: 1 },
      { table: "detection_runs", deleted: 1 },
      { table: "idempotency_keys", deleted: 1 },
    ]);
    expect(report.deletedTotal).toBe(5);

    const keys = await db
      .select({ keyHash: idempotencyKeys.keyHash })
      .from(idempotencyKeys)
      .where(inArray(idempotencyKeys.keyHash, [oldKey.keyHash, newKey.keyHash]));
    expect(keys).toEqual([{ keyHash: newKey.keyHash }]);

    const receipts = await db
      .select({ id: ingestEventReceipts.eventId })
      .from(ingestEventReceipts)
      .where(inArray(ingestEventReceipts.eventId, [oldReceipt.eventId, newReceipt.eventId]));
    const letters = await db
      .select({ id: deadLetterQueue.id })
      .from(deadLetterQueue)
      .where(inArray(deadLetterQueue.failedAt, [oldLetter.failedAt, newLetter.failedAt]));

    expect(receipts).toEqual([{ id: newReceipt.eventId }]);
    expect(letters).toHaveLength(1);
  });

  it("reports an empty run when there is nothing to remove", async () => {
    const report = await service.cleanup(now);

    expect(report.results.every((result) => result.deleted === 0 && !result.error)).toBe(true);
    expect(report.deletedTotal).toBe(0);
  });
});
