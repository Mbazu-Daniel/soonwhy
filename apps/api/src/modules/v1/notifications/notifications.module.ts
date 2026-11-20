import { Module } from "@nestjs/common";
import { NotificationsController } from "./presentation/notifications.controller";
import { OrgNotificationsController } from "./presentation/org-notifications.controller";
import { CronController } from "./presentation/cron.controller";
import { NotificationService } from "./application/notification.service";
import { NotificationDispatcher } from "./domain/notification-dispatcher";
import { ZeptoMailService } from "./application/zepto-mail.service";
import { ResendMailService } from "./application/resend-mail.service";
import { SlackService } from "./application/slack.service";
import { WebhookService } from "./application/webhook.service";
import { EmailChannel } from "./channels/email.channel";
import { SlackChannel } from "./channels/slack.channel";
import { WebhookChannel } from "./channels/webhook.channel";
import { WeeklySummaryService } from "@soonwhy/shared";
import { db } from "../../../common/db";
import { notificationChannels } from "../../../common/db/schema";
import { eq } from "drizzle-orm";
import { AlertEvaluationService } from "./application/alert-evaluation.service";
import { MetricsModule } from "../telemetry/metrics/metrics.module";
import { AlertRuleEngineService } from "./alert-engine/alert-rule-engine.service";
import { TelemetryModule } from "../../../common/telemetry";
import { IncidentsService } from "../detection/incidents/application/incidents.service";
import { IncidentsRepository } from "../detection/incidents/infrastructure/incidents.repository";
import { MaintenanceWindowsService } from "../detection/maintenance-windows/application/maintenance-windows.service";
import { MaintenanceWindowsRepository } from "../detection/maintenance-windows/infrastructure/maintenance-windows.repository";
import { SyntheticProbesModule } from "../detection/synthetic-probes/synthetic-probes.module";
import { CronLeaseModule } from "../../../common/cron/cron-lease.module";
import { WeeklySummaryCron } from "./application/weekly-summary.cron";
import { SyntheticProbesCron } from "./application/synthetic-probes.cron";
import { WebhookRetryCron } from "./application/retry-failed.cron";
import { DedupService } from "./dedup/dedup.service";

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
    CronLeaseModule,
    MetricsModule,
    TelemetryModule,
    SyntheticProbesModule,
  ],
  controllers: [NotificationsController, OrgNotificationsController, CronController],
  providers: [
    ZeptoMailService,
    ResendMailService,
    SlackService,
    WebhookService,
    EmailChannel,
    SlackChannel,
    WebhookChannel,
    NotificationDispatcher,
    NotificationService,
    AlertRuleEngineService,
    AlertEvaluationService,
    IncidentsService,
    IncidentsRepository,
    MaintenanceWindowsService,
    MaintenanceWindowsRepository,
    DedupService,
    WeeklySummaryCron,
    SyntheticProbesCron,
    WebhookRetryCron,
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
    ResendMailService,
    SlackService,
    WebhookService,
    AlertEvaluationService,
  ],
})
export class NotificationsModule {}
