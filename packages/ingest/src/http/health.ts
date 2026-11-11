import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { NatsService } from "@soonwhy/shared";
import { IngestConcurrency } from "../pipeline/concurrency";
import { IngestStats } from "../pipeline/stats";

@Controller("api/health")
export class HealthController {
  constructor(
    private readonly nats: NatsService,
    private readonly stats: IngestStats,
    private readonly concurrency: IngestConcurrency,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async status() {
    const ready = this.nats.isReady();
    return {
      status: ready ? "ok" : "degraded",
      ready,
      queue: {
        provider: "nats-jetstream",
        connected: ready,
      },
      capacity: this.concurrency.snapshot(),
      stats: this.stats.snapshot(),
      consumers: ready ? await this.nats.consumerSnapshot() : [],
    };
  }

  @Get("stats")
  @HttpCode(HttpStatus.OK)
  async statsSnapshot() {
    return {
      stats: this.stats.snapshot(),
      capacity: this.concurrency.snapshot(),
      consumers: this.nats.isReady() ? await this.nats.consumerSnapshot() : [],
    };
  }
}
