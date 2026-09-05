import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DataArchivalService } from './data-archival.service';
import { DataArchivalJob } from './data-archival.job';
import { ClickhouseService } from './clickhouse.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [DataArchivalService, DataArchivalJob, ClickhouseService],
})
export class CronModule {}
