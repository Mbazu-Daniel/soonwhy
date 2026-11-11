import { Module } from "@nestjs/common";
import { IngestLimitsController, InternalIngestLimitsController } from "./ingest-limits.controller";
import { IngestLimitsService } from "./ingest-limits.service";
import { IngestLimitsRepository } from "./ingest-limits.repository";

@Module({
  controllers: [IngestLimitsController, InternalIngestLimitsController],
  providers: [IngestLimitsService, IngestLimitsRepository],
  exports: [IngestLimitsService],
})
export class IngestLimitsModule {}
