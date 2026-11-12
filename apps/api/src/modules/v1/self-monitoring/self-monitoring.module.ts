import { Module, OnModuleInit } from "@nestjs/common";
import { SelfMonitoringController } from "./self-monitoring.controller";
import { SelfMonitoringService } from "./self-monitoring.service";
import { PipelineHealthCron } from "./pipeline-health.cron";
import { QuickwitService } from "@soonwhy/shared";

@Module({
  controllers: [SelfMonitoringController],
  providers: [SelfMonitoringService, PipelineHealthCron, QuickwitService],
  exports: [SelfMonitoringService],
})
export class SelfMonitoringModule implements OnModuleInit {
  constructor(private readonly service: SelfMonitoringService) {}

  onModuleInit() {
    void this.service.ensureSelfMonitoringAlerts();
  }
}
