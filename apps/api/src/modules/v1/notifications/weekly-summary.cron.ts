import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WeeklySummaryService } from "@soonwhy/shared";

@Injectable()
export class WeeklySummaryCron {
  private readonly logger = new Logger(WeeklySummaryCron.name);

  constructor(private readonly weeklySummaryService: WeeklySummaryService) {}

  @Cron(CronExpression.EVERY_WEEK, {
    name: "weekly-summary",
    timeZone: "UTC",
  })
  async runWeeklySummary() {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const summary = {
      period: { from: from.toISOString(), to: now.toISOString() },
      incidents: { total: 0, active: 0, resolved: 0 },
      notifications: { total: 0, sent: 0, failed: 0 },
      generatedAt: now.toISOString(),
    };
    try {
      return await this.weeklySummaryService.dispatchWeeklySummary({
        from: from.toISOString(),
        to: now.toISOString(),
        summary,
      });
    } catch (error) {
      this.logger.error(
        "Failed to dispatch weekly summary",
        error instanceof Error ? error.message : String(error),
      );
      return summary;
    }
  }
}
