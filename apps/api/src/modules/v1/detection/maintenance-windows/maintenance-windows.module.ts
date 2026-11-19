import { Module } from "@nestjs/common";
import { MaintenanceWindowsController } from "./presentation/maintenance-windows.controller";
import { MaintenanceWindowsService } from "./application/maintenance-windows.service";
import { MaintenanceWindowsRepository } from "./infrastructure/maintenance-windows.repository";

@Module({
  controllers: [MaintenanceWindowsController],
  providers: [MaintenanceWindowsService, MaintenanceWindowsRepository],
  exports: [MaintenanceWindowsService],
})
export class MaintenanceWindowsModule {}
