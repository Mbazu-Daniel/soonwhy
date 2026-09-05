import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ClickhouseModule } from '../../../common/clickhouse';

@Module({
  imports: [ClickhouseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
