import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { TelemetryModule } from "../../../common/telemetry";
import { ErrorsModule } from "../errors";

@Module({
  imports: [TelemetryModule, ErrorsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
