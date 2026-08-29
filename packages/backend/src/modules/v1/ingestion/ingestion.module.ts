import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionConsumer } from './ingestion.consumer';
import { NatsModule } from '../../../nats';
import { ClickhouseModule } from '../../../clickhouse';

@Module({
  imports: [NatsModule, ClickhouseModule],
  controllers: [IngestionController],
  providers: [IngestionService, IngestionConsumer],
})
export class IngestionModule {}
