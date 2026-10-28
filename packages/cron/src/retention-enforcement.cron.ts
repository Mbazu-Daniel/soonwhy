import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { QuickwitService, QUICKWIT_INDEXES } from "@soonwhy/shared";

@Injectable()
export class RetentionEnforcementCron {
  private readonly logger = new Logger(RetentionEnforcementCron.name);
  private readonly retentionDays = Number(
    process.env.TELEMETRY_RETENTION_DAYS || 30,
  );

  constructor(private readonly quickwit: QuickwitService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: "telemetry-retention",
    timeZone: "UTC",
  })
  async enforce() {
    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    for (const indexId of Object.values(QUICKWIT_INDEXES)) {
      try {
        await this.quickwit.purgeOlderThan(indexId, "timestamp", cutoff);
      } catch (error: unknown) {
        this.logger.error(
          `Retention purge failed for ${indexId}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }
}
