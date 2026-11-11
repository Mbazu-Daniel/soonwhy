import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DB, ingestEventReceipts, type Db } from "@soonwhy/shared";
import { lt } from "drizzle-orm";

@Injectable()
export class ReceiptCleanupCron {
  private readonly logger = new Logger(ReceiptCleanupCron.name);
  private readonly retentionHours = Number(
    process.env.INGEST_RECEIPT_RETENTION_HOURS ?? 24,
  );

  constructor(@Inject(DB) private readonly db: Db) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: "ingest-receipt-cleanup",
    timeZone: "UTC",
  })
  async cleanup() {
    const cutoff = new Date(
      Date.now() - this.retentionHours * 60 * 60 * 1000,
    );
    try {
      await this.db
        .delete(ingestEventReceipts)
        .where(lt(ingestEventReceipts.createdAt, cutoff));
    } catch (error) {
      this.logger.error(
        "Failed to clean ingest receipts",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
