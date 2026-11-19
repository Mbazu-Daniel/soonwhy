import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { EvidenceGraphService } from "./evidence-graph.service";
import { EvidenceGraphController } from "./evidence-graph.controller";
import { EvidenceGraphRepository } from "./evidence-graph.repository";
import { EvidenceGraphCache } from "./evidence-graph.cache";
import { EvidenceGraphCleanupService } from "./evidence-graph-cleanup.service";
import { EvidenceGraphHealthService } from "./evidence-graph-health.service";
import { TelemetryIngestionService } from "../application/telemetry-ingestion.service";
import { DetectorConfigService } from "../application/detector-config.service";
import { DetectorConfigController } from "../presentation/detector-config.controller";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [EvidenceGraphController, DetectorConfigController],
  providers: [
    EvidenceGraphService,
    EvidenceGraphRepository,
    EvidenceGraphCache,
    EvidenceGraphCleanupService,
    EvidenceGraphHealthService,
    TelemetryIngestionService,
    DetectorConfigService,
  ],
  exports: [
    EvidenceGraphService,
    EvidenceGraphRepository,
    EvidenceGraphCache,
    EvidenceGraphHealthService,
    TelemetryIngestionService,
    DetectorConfigService,
  ],
})
export class EvidenceGraphModule {}
