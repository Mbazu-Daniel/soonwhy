import { Module } from "@nestjs/common";
import { IngestHealthController } from "./ingest-health.controller";
import { IngestHealthService } from "./ingest-health.service";

@Module({
  controllers: [IngestHealthController],
  providers: [IngestHealthService],
  exports: [IngestHealthService],
})
export class IngestHealthModule {}
