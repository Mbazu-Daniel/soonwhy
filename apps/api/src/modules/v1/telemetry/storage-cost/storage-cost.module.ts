import { Module } from "@nestjs/common";
import { StorageCostController } from "./presentation/storage-cost.controller";
import { StorageCostMonitoringService } from "./application/storage-cost.service";

@Module({
  controllers: [StorageCostController],
  providers: [StorageCostMonitoringService],
  exports: [StorageCostMonitoringService],
})
export class StorageCostModule {}
