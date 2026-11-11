import { Module, OnModuleInit } from "@nestjs/common";
import { SelfMonitoringController } from "./self-monitoring.controller";
import { SelfMonitoringService } from "./self-monitoring.service";

@Module({
  controllers: [SelfMonitoringController],
  providers: [SelfMonitoringService],
  exports: [SelfMonitoringService],
})
export class SelfMonitoringModule implements OnModuleInit {
  constructor(private readonly service: SelfMonitoringService) {}

  async onModuleInit() {
    // Ensure self-monitoring alerts exist on startup
    await this.service.ensureSelfMonitoringAlerts();
  }
}
