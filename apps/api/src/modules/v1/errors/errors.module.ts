import { Module } from "@nestjs/common";
import { TelemetryModule } from "../../../common/telemetry";
import { ErrorsService } from "./errors.service";
import { ErrorIgnoreRulesController } from "./ignore-rules.controller";

@Module({
  imports: [TelemetryModule],
  controllers: [ErrorIgnoreRulesController],
  providers: [ErrorsService],
  exports: [ErrorsService],
})
export class ErrorsModule {}
