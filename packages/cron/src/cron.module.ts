import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClickhouseService } from '@soonwhy/shared';
import { DataArchivalService } from './data-archival.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [DataArchivalService, ClickhouseService],
})
export class CronModule {}
