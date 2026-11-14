import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { TelemetryModule } from "../../../common/telemetry";
import { ErrorsModule } from "../errors";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [TelemetryModule, ErrorsModule, MetricsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
