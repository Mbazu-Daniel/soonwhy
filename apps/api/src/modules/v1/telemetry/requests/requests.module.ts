import { Module } from "@nestjs/common";
import { RequestsController } from "./presentation/requests.controller";
import { RequestsService } from "./application/requests.service";
import { RequestsRepository } from "./infrastructure/requests.repository";
import { TelemetryModule } from "../../../../common/telemetry";

@Module({
  imports: [TelemetryModule],
  controllers: [RequestsController],
  providers: [RequestsService, RequestsRepository],
  exports: [RequestsService],
})
export class RequestsModule {}
