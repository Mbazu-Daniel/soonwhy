import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class WeeklySummaryCron {
  private readonly logger = new Logger(WeeklySummaryCron.name);
  private readonly backendUrl =
    process.env.BACKEND_URL || "http://localhost:3001";

  constructor(private readonly http: HttpService) {}

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
      await firstValueFrom(
        this.http.post(
          `${this.backendUrl}/api/v1/notifications/cron/weekly-summary`,
          {
            from: from.toISOString(),
            to: now.toISOString(),
            summary,
          },
        ),
      );
    } catch (error: unknown) {
      this.logger.error(
        "Failed to dispatch weekly summary to backend",
        error instanceof Error ? error.message : String(error),
      );
    }

    return summary;
  }
}
