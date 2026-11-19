import { Module } from "@nestjs/common";
import { HistoricalAnalysisController } from "./presentation/historical-analysis.controller";
import { HistoricalAnalysisService } from "./application/historical-analysis.service";
import { MetricsModule } from "../../telemetry/metrics/metrics.module";
import { DeploymentsModule } from "../../delivery/deployments/deployments.module";

@Module({
  imports: [MetricsModule, DeploymentsModule],
  controllers: [HistoricalAnalysisController],
  providers: [HistoricalAnalysisService],
  exports: [HistoricalAnalysisService],
})
export class HistoricalAnalysisModule {}
