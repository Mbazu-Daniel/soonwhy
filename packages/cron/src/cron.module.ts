import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HttpModule } from "@nestjs/axios";
import { QuickwitService } from "@soonwhy/shared";
import { WeeklySummaryCron } from "./weekly-summary.cron";
import { RetentionEnforcementCron } from "./retention-enforcement.cron";

@Module({
  imports: [ScheduleModule.forRoot(), HttpModule],
  providers: [QuickwitService, WeeklySummaryCron, RetentionEnforcementCron],
})
export class CronModule {}
