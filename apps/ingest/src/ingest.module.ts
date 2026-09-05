import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionConsumer } from './ingestion.consumer';
import { ClickhouseService } from './clickhouse.service';
import { NatsService } from './nats.service';
import { ApiKeysService } from './api-keys.service';

@Module({
  controllers: [IngestionController],
  providers: [IngestionService, IngestionConsumer, ClickhouseService, NatsService, ApiKeysService],
})
export class IngestModule {}
