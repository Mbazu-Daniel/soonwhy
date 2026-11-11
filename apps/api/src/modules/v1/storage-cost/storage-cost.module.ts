import { Module } from "@nestjs/common";
import { StorageCostController } from "./storage-cost.controller";
import { StorageCostMonitoringService } from "./storage-cost.service";

@Module({
  controllers: [StorageCostController],
  providers: [StorageCostMonitoringService],
  exports: [StorageCostMonitoringService],
})
export class StorageCostModule {}
