import { Module } from "@nestjs/common";
import { CapacityMonitoringController } from "./presentation/capacity-monitoring.controller";
import { CapacityMonitoringService } from "./application/capacity-monitoring.service";

@Module({
  controllers: [CapacityMonitoringController],
  providers: [CapacityMonitoringService],
  exports: [CapacityMonitoringService],
})
export class CapacityMonitoringModule {}
