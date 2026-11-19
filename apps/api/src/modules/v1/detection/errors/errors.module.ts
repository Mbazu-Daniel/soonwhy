import { Module } from "@nestjs/common";
import { TelemetryModule } from "../../../../common/telemetry";
import { ErrorIgnoreRulesService } from "./application/ignore-rules.service";
import { ErrorsService } from "./application/errors.service";
import { ErrorIgnoreRulesController } from "./presentation/ignore-rules.controller";

@Module({
  imports: [TelemetryModule],
  controllers: [ErrorIgnoreRulesController],
  providers: [ErrorsService, ErrorIgnoreRulesService],
  exports: [ErrorsService],
})
export class ErrorsModule {}
