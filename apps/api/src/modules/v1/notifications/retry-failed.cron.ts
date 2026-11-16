import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CronLeaseService } from "../../../common/cron/cron-lease.service";
import { NotificationService } from "./notification.service";

@Injectable()
export class WebhookRetryCron {
  private readonly logger = new Logger(WebhookRetryCron.name);

  constructor(
    private readonly notifications: NotificationService,
    @Optional() private readonly lease?: CronLeaseService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: "webhook-retry-failed",
    timeZone: "UTC",
  })
  async retryFailed() {
    if (this.lease) {
      await this.lease.runExclusive("webhook-retry-failed", 4 * 60 * 1000, () =>
        this.run(),
      );
      return;
    }
    await this.run();
  }

  private async run() {
    try {
      const result = await this.notifications.retryFailedNotifications();
      if (result.processed > 0) {
        this.logger.log(
          `Re-drove ${result.processed} failed notifications (${result.succeeded} succeeded, ${result.permanentlyFailed} permanently failed)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to re-drive failed notifications: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
