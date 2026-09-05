import { Module } from '@nestjs/common';
import {
  ApiKeysService,
  ClickhouseService,
  NatsService,
  RateLimiter,
} from '@soonwhy/shared';
import { IngestController } from './http/controller';
import { IngestConsumer } from './pipeline/consumer';
import { IngestStats } from './pipeline/stats';

@Module({
  controllers: [IngestController],
  providers: [
    ApiKeysService,
    RateLimiter,
    NatsService,
    ClickhouseService,
    IngestStats,
    IngestConsumer,
  ],
})
export class IngestModule {}
