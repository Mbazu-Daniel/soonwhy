import { Module } from '@nestjs/common';
import { DataArchivalService } from './data-archival.service';
import { DataArchivalJob } from './data-archival.job';
import { ClickhouseModule } from '../../clickhouse';

@Module({
  imports: [ClickhouseModule],
  providers: [DataArchivalService, DataArchivalJob],
})
export class DataArchivalModule {}
