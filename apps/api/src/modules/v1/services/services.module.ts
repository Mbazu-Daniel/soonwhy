import { Module } from "@nestjs/common";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";
import { ServiceOperationsService } from "./service-operations.service";
import { ServicesRepository } from "./services.repository";
import { TelemetryModule } from "../../../common/telemetry";

@Module({
  imports: [TelemetryModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServicesRepository, ServiceOperationsService],
  exports: [ServicesService],
})
export class ServicesModule {}
