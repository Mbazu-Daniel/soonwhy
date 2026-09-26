import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { LogsRepository } from './logs.repository';
import { TelemetryModule } from '../../../common/telemetry';

@Module({
  imports: [TelemetryModule],
  controllers: [LogsController],
  providers: [LogsService, LogsRepository],
  exports: [LogsService],
})
export class LogsModule {}
