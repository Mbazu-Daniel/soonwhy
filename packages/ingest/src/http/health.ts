import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { NatsService } from '@soonwhy/shared';
import { IngestStats } from '../pipeline/stats';

@Controller('health')
export class HealthController {
  constructor(
    private readonly nats: NatsService,
    private readonly stats: IngestStats,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  status() {
    const ready = this.nats.isReady();
    return {
      status: ready ? 'ok' : 'degraded',
      ready,
      queue: {
        provider: 'nats-jetstream',
        connected: ready,
        subscriptions: this.nats.subscriptionSnapshot(),
      },
      stats: this.stats.snapshot(),
    };
  }
}
