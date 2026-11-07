import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { MetricsRepository } from "./metrics.repository";
import { TelemetryModule } from "../../../common/telemetry";

@Module({
  imports: [TelemetryModule],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsRepository],
  exports: [MetricsService, MetricsRepository],
})
export class MetricsModule {}
