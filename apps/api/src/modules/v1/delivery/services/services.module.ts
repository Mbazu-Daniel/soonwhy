import { Module } from "@nestjs/common";
import { ServicesController } from "./presentation/services.controller";
import { ServicesService } from "./application/services.service";
import { ServiceOperationsService } from "./application/service-operations.service";
import { ServicesRepository } from "./infrastructure/services.repository";
import { TelemetryModule } from "../../../../common/telemetry";

@Module({
  imports: [TelemetryModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServicesRepository, ServiceOperationsService],
  exports: [ServicesService],
})
export class ServicesModule {}
