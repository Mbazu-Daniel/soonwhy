import { Module } from '@nestjs/common';
import { TelemetryQueryService } from './telemetry-query.service';

@Module({
  providers: [TelemetryQueryService],
  exports: [TelemetryQueryService],
})
export class TelemetryModule {}
