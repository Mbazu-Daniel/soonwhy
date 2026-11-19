import { Module } from "@nestjs/common";
import { IngestLimitsController, InternalIngestLimitsController } from "./presentation/ingest-limits.controller";
import { IngestLimitsService } from "./application/ingest-limits.service";
import { IngestLimitsRepository } from "./infrastructure/ingest-limits.repository";

@Module({
  controllers: [IngestLimitsController, InternalIngestLimitsController],
  providers: [IngestLimitsService, IngestLimitsRepository],
  exports: [IngestLimitsService],
})
export class IngestLimitsModule {}
