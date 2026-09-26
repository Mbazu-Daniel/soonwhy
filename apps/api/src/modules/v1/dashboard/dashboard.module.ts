import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TelemetryModule } from '../../../common/telemetry';

@Module({
  imports: [TelemetryModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
