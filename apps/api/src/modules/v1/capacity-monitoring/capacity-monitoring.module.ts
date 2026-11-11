import { Module } from "@nestjs/common";
import { CapacityMonitoringController } from "./capacity-monitoring.controller";
import { CapacityMonitoringService } from "./capacity-monitoring.service";

@Module({
  controllers: [CapacityMonitoringController],
  providers: [CapacityMonitoringService],
  exports: [CapacityMonitoringService],
})
export class CapacityMonitoringModule {}
