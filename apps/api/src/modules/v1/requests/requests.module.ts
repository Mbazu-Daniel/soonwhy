import { Module } from "@nestjs/common";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
import { RequestsRepository } from "./requests.repository";
import { TelemetryModule } from "../../../common/telemetry";

@Module({
  imports: [TelemetryModule],
  controllers: [RequestsController],
  providers: [RequestsService, RequestsRepository],
  exports: [RequestsService],
})
export class RequestsModule {}
