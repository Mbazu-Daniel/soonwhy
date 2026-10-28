import { Module } from "@nestjs/common";
import {
  ApiKeysService,
  DB,
  createDb,
  NatsService,
  RateLimiter,
  QuickwitService,
} from "@soonwhy/shared";
import { IngestController } from "./http/controller";
import { IngestConcurrency } from "./pipeline/concurrency";
import { HealthController } from "./http/health";
import { IngestConsumer } from "./pipeline/consumer";
import { IngestStats } from "./pipeline/stats";

@Module({
  controllers: [IngestController, HealthController],
  providers: [
    { provide: DB, useFactory: createDb },
    ApiKeysService,
    RateLimiter,
    NatsService,
    IngestStats,
    IngestConcurrency,
    QuickwitService,
    IngestConsumer,
  ],
})
export class IngestModule {}
