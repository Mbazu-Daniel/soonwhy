import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HttpModule } from "@nestjs/axios";
import {
  DB,
  QuickwitService,
  createDb,
} from "@soonwhy/shared";
import { WeeklySummaryCron } from "./weekly-summary.cron";
import { RetentionEnforcementCron } from "./retention-enforcement.cron";
import { PipelineHealthCron } from "./pipeline-health.cron";
import { ReceiptCleanupCron } from "./receipt-cleanup.cron";
import { AlertEvaluationCron } from "./alert-evaluation.cron";

@Module({
  imports: [ScheduleModule.forRoot(), HttpModule],
  providers: [
    { provide: DB, useFactory: createDb },
    QuickwitService,
    WeeklySummaryCron,
    RetentionEnforcementCron,
    PipelineHealthCron,
    ReceiptCleanupCron,
    AlertEvaluationCron,
  ],
})
export class CronModule {}
