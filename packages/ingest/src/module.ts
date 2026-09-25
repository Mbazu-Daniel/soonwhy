import { Module } from '@nestjs/common';
import { ApiKeysService, QuickwitService, NatsService, RateLimiter } from '@soonwhy/shared';
import { IngestController } from './http/controller';
import { IngestConcurrency } from './pipeline/concurrency';
import { HealthController } from './http/health';
import { IngestConsumer } from './pipeline/consumer';
import { IngestStats } from './pipeline/stats';

@Module({
  controllers: [IngestController, HealthController],
  providers: [ApiKeysService, RateLimiter, NatsService, QuickwitService, IngestStats, IngestConcurrency, IngestConsumer],
})
export class IngestModule {}
