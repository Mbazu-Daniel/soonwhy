import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { OrgNotificationsController } from "./org-notifications.controller";
import { CronController } from "./cron.controller";
import { NotificationService } from "./notification.service";
import { ZeptoMailService } from "./zepto-mail.service";
import { SlackService } from "./slack.service";
import { WebhookService } from "./webhook.service";
import { EmailChannel } from "./channels/email.channel";
import { SlackChannel } from "./channels/slack.channel";
import { WebhookChannel } from "./channels/webhook.channel";
import { WeeklySummaryService } from "@soonwhy/shared";
import { db } from "../../../common/db";
import { notificationChannels } from "../../../common/db/schema";
import { eq } from "drizzle-orm";
import { AlertEvaluationService } from "./alert-evaluation.service";
import { MetricsModule } from "../../v1/metrics/metrics.module";
import { AlertRuleEngineService } from "./alert-engine/alert-rule-engine.service";
import { TelemetryModule } from "../../../common/telemetry";

const getProjectsWithActiveChannels = async () => {
  return db
    .selectDistinctOn([notificationChannels.projectId], {
      projectId: notificationChannels.projectId,
      orgId: notificationChannels.orgId,
    })
    .from(notificationChannels)
    .where(eq(notificationChannels.isActive, true));
};

@Module({
  imports: [
    MetricsModule,
    TelemetryModule,
  ],
  controllers: [NotificationsController, OrgNotificationsController, CronController],
  providers: [
    ZeptoMailService,
    SlackService,
    WebhookService,
    EmailChannel,
    SlackChannel,
    WebhookChannel,
    NotificationService,
    AlertRuleEngineService,
    AlertEvaluationService,
    {
      provide: WeeklySummaryService,
      useFactory: (notificationService: NotificationService) =>
        new WeeklySummaryService({
          getProjectsWithActiveChannels,
          dispatchAlert: async (input: { projectId: string; orgId: string }) => {
            const result = await notificationService.dispatchAlert(
              input as Parameters<NotificationService["dispatchAlert"]>[0],
            );
            return {
              sent: result.sent,
              failed: result.failed,
              results: [
                {
                  projectId: input.projectId,
                  orgId: input.orgId,
                  sent: result.sent,
                  failed: result.failed,
                  results: result.results,
                },
              ],
            };
          },
        }),
      inject: [NotificationService],
    },
  ],
  exports: [
    NotificationService,
    ZeptoMailService,
    SlackService,
    WebhookService,
    AlertEvaluationService,
  ],
})
export class NotificationsModule {}
