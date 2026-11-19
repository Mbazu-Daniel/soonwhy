import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WeeklySummaryService } from "@soonwhy/shared";
import { CronLeaseService } from "../../../../common/cron/cron-lease.service";
import { WEEKLY_SUMMARY_CRON_NAME, WEEKLY_SUMMARY_LEASE_MS, WEEKLY_SUMMARY_WINDOW_MS } from "../domain/weekly-summary.constants";
import { weeklySummaryStats } from "../infrastructure/weekly-summary.stats";

@Injectable()
export class WeeklySummaryCron {
  private readonly logger = new Logger(WeeklySummaryCron.name);

  constructor(
    private readonly weeklySummaryService: WeeklySummaryService,
    @Optional() private readonly lease?: CronLeaseService,
  ) {}

  @Cron(CronExpression.EVERY_WEEK, { name: WEEKLY_SUMMARY_CRON_NAME, timeZone: "UTC" })
  async runWeeklySummary(): Promise<void> {
    if (this.lease) {
      await this.lease.runExclusive(WEEKLY_SUMMARY_CRON_NAME, WEEKLY_SUMMARY_LEASE_MS, () => this.dispatch());
      return;
    }
    await this.dispatch();
  }

  private async dispatch(): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() - WEEKLY_SUMMARY_WINDOW_MS);
    try {
      const stats = await weeklySummaryStats(from, now);
      await this.weeklySummaryService.dispatchWeeklySummary({
        from: from.toISOString(),
        to: now.toISOString(),
        summary: {
          period: { from: from.toISOString(), to: now.toISOString() },
          ...stats,
          generatedAt: now.toISOString(),
        },
      });
    } catch (error) {
      this.logger.error("Failed to dispatch weekly summary", error instanceof Error ? error.message : String(error));
    }
  }
}
