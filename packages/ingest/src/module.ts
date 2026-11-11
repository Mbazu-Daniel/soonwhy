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
import { MetricsController } from "./http/metrics";
import { IngestConsumer } from "./pipeline/consumer";
import { IngestStats } from "./pipeline/stats";
import { DlqRepository } from "./pipeline/dlq.repository";
import { IngestReceiptRepository } from "./pipeline/receipt.repository";

@Module({
  controllers: [IngestController, HealthController, MetricsController],
  providers: [
    { provide: DB, useFactory: createDb },
    ApiKeysService,
    RateLimiter,
    NatsService,
    IngestStats,
    IngestConcurrency,
    DlqRepository,
    IngestReceiptRepository,
    QuickwitService,
    IngestConsumer,
  ],
})
export class IngestModule {}
