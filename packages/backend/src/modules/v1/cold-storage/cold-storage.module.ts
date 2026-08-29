import { Module } from '@nestjs/common';
import { ColdStorageService } from './cold-storage.service';
import { ClickhouseModule } from '../../../clickhouse';

@Module({
  imports: [ClickhouseModule],
  providers: [ColdStorageService],
})
export class ColdStorageModule {}
