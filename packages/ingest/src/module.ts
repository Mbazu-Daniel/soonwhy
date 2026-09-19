import { Module } from '@nestjs/common';
import {
  ApiKeysService,
  QuickwitService,
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
    QuickwitService,
    IngestStats,
    IngestConsumer,
  ],
})
export class IngestModule {}
