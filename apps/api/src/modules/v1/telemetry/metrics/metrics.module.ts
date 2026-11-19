import { Module } from "@nestjs/common";
import { MetricsController } from "./presentation/metrics.controller";
import { MetricsService } from "./application/metrics.service";
import { MetricsRepository } from "./infrastructure/metrics.repository";
import { TelemetryModule } from "../../../../common/telemetry";

@Module({
  imports: [TelemetryModule],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsRepository],
  exports: [MetricsService, MetricsRepository],
})
export class MetricsModule {}
