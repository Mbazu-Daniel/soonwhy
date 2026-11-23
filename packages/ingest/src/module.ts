import { Module } from "@nestjs/common";
import {
  ApiKeyAuthenticator,
  HostMetricsTarget,
  HostRegistry,
  DB,
  createDb,
  NatsService,
  RateLimiter,
  createRedisClient,
  QuickwitService,
} from "@soonwhy/shared";
import { IngestController } from "./http/controller";
import { IngestConcurrency } from "./pipeline/concurrency";
import { HealthController } from "./http/health";
import { RootController } from "./http/root";
import { IngestConsumer } from "./pipeline/consumer";
import { IngestStats } from "./pipeline/stats";
import { DlqRepository } from "./pipeline/dlq.repository";
import { AlertNotifier } from "./pipeline/alert-notifier";
import { ClaimLease } from "./pipeline/claim-lease";
import { DuplicateMonitor } from "./pipeline/duplicate-monitor";
import { VisibilityCanary } from "./pipeline/visibility-canary";
import { IngestReceiptRepository } from "./pipeline/receipt.repository";

@Module({
  controllers: [IngestController, HealthController, RootController],
  providers: [
    { provide: DB, useFactory: createDb },
    ApiKeyAuthenticator,
    HostMetricsTarget,
    HostRegistry,
    RateLimiter,
    NatsService,
    IngestStats,
    IngestConcurrency,
    DlqRepository,
    ClaimLease,
    AlertNotifier,
    DuplicateMonitor,
    { provide: VisibilityCanary, useFactory: () => new VisibilityCanary(createRedisClient()) },
    IngestReceiptRepository,
    QuickwitService,
    IngestConsumer,
  ],
})
export class IngestModule {}
