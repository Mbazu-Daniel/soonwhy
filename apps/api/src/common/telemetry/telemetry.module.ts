import { Module } from "@nestjs/common";
import { QuickwitService } from "@soonwhy/shared";
import { TelemetryQueryService } from "./telemetry-query.service";

@Module({
  providers: [QuickwitService, TelemetryQueryService],
  exports: [QuickwitService, TelemetryQueryService],
})
export class TelemetryModule {}
