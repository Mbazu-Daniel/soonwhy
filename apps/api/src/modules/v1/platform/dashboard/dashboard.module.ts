import { Module } from "@nestjs/common";
import { DashboardController } from "./presentation/dashboard.controller";
import { DashboardService } from "./application/dashboard.service";
import { TelemetryModule } from "../../../../common/telemetry";
import { ErrorsModule } from "../../detection/errors";
import { MetricsModule } from "../../telemetry/metrics/metrics.module";

@Module({
  imports: [TelemetryModule, ErrorsModule, MetricsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
