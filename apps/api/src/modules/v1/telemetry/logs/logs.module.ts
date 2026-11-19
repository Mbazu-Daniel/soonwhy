import { Module } from "@nestjs/common";
import { LogsController } from "./presentation/logs.controller";
import { LogsService } from "./application/logs.service";
import { LogsRepository } from "./infrastructure/logs.repository";
import { TelemetryModule } from "../../../../common/telemetry";

@Module({
  imports: [TelemetryModule],
  controllers: [LogsController],
  providers: [LogsService, LogsRepository],
  exports: [LogsService],
})
export class LogsModule {}
