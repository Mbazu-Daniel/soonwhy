import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { lt, lte } from "drizzle-orm";
import { db } from "../db";
import {
  deadLetterQueue,
  detectionRuns,
  idempotencyKeys,
  ingestEventReceipts,
  notificationLogs,
} from "../db/schema";
import { CLEANUP_RETENTION_DAYS } from "./cleanup.types";
import type { CleanupReport, CleanupTableResult } from "./cleanup.types";

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runScheduledCleanup(): Promise<void> {
    const report = await this.cleanup();

    this.logger.log(
      `Scheduled cleanup removed ${report.deletedTotal} rows across ${report.results.length} tables`,
    );
  }

  async cleanup(now = new Date()): Promise<CleanupReport> {
    const startedAt = now.toISOString();
    const results = await Promise.all([
      this.removeIngestReceipts(now),
      this.removeDeadLetters(now),
      this.removeNotificationLogs(now),
      this.removeDetectionRuns(now),
      this.removeIdempotencyKeys(now),
    ]);

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      results,
      deletedTotal: results.reduce((total, result) => total + result.deleted, 0),
    };
  }

  private async removeIngestReceipts(now: Date): Promise<CleanupTableResult> {
    return this.remove(
      "ingest_event_receipts",
      () =>
        db
          .delete(ingestEventReceipts)
          .where(lt(ingestEventReceipts.createdAt, cutoff(now, CLEANUP_RETENTION_DAYS.ingestReceipts)))
          .returning({ id: ingestEventReceipts.eventId }),
    );
  }

  private async removeDeadLetters(now: Date): Promise<CleanupTableResult> {
    return this.remove(
      "dead_letter_queue",
      () =>
        db
          .delete(deadLetterQueue)
          .where(lt(deadLetterQueue.failedAt, cutoff(now, CLEANUP_RETENTION_DAYS.deadLetters)))
          .returning({ id: deadLetterQueue.id }),
    );
  }

  private async removeNotificationLogs(now: Date): Promise<CleanupTableResult> {
    return this.remove(
      "notification_logs",
      () =>
        db
          .delete(notificationLogs)
          .where(lt(notificationLogs.createdAt, cutoff(now, CLEANUP_RETENTION_DAYS.notificationLogs)))
          .returning({ id: notificationLogs.id }),
    );
  }

  private async removeDetectionRuns(now: Date): Promise<CleanupTableResult> {
    return this.remove(
      "detection_runs",
      () =>
        db
          .delete(detectionRuns)
          .where(lt(detectionRuns.startedAt, cutoff(now, CLEANUP_RETENTION_DAYS.detectionRuns)))
          .returning({ id: detectionRuns.id }),
    );
  }

  private async removeIdempotencyKeys(now: Date): Promise<CleanupTableResult> {
    return this.remove(
      "idempotency_keys",
      // Expiry is checked inside the DELETE itself, so a row a retry took
      // over between statements is always kept.
      () =>
        db
          .delete(idempotencyKeys)
          .where(lte(idempotencyKeys.expiresAt, now.getTime()))
          .returning({ id: idempotencyKeys.keyHash }),
    );
  }

  private async remove(
    table: string,
    removeRows: () => Promise<Array<{ id: unknown }>>,
  ): Promise<CleanupTableResult> {
    try {
      const rows = await removeRows();
      return { table, deleted: rows.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cleanup failed for ${table}: ${message}`);
      return { table, deleted: 0, error: message };
    }
  }
}

export function cutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1_000);
}
