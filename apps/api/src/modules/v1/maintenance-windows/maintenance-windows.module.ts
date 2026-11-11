import { Module } from "@nestjs/common";
import { MaintenanceWindowsController } from "./maintenance-windows.controller";
import { MaintenanceWindowsService } from "./maintenance-windows.service";
import { MaintenanceWindowsRepository } from "./maintenance-windows.repository";

@Module({
  controllers: [MaintenanceWindowsController],
  providers: [MaintenanceWindowsService, MaintenanceWindowsRepository],
  exports: [MaintenanceWindowsService],
})
export class MaintenanceWindowsModule {}
