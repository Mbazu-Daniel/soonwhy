import { Module } from "@nestjs/common";
import { TelemetryModule } from "../../../common/telemetry";
import { IngestHealthModule } from "../ingest-health/ingest-health.module";
import { PipelineLagController } from "./pipeline-lag.controller";
import { PipelineLagService } from "./pipeline-lag.service";

@Module({
  imports: [TelemetryModule, IngestHealthModule],
  controllers: [PipelineLagController],
  providers: [PipelineLagService],
})
export class PipelineLagModule {}
