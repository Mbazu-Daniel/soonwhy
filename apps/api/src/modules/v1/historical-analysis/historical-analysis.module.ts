import { Module } from "@nestjs/common";
import { HistoricalAnalysisController } from "./historical-analysis.controller";
import { HistoricalAnalysisService } from "./historical-analysis.service";
import { MetricsModule } from "../metrics/metrics.module";
import { DeploymentsModule } from "../deployments/deployments.module";

@Module({
  imports: [MetricsModule, DeploymentsModule],
  controllers: [HistoricalAnalysisController],
  providers: [HistoricalAnalysisService],
  exports: [HistoricalAnalysisService],
})
export class HistoricalAnalysisModule {}
