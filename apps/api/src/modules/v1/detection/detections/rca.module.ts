import { Module } from "@nestjs/common";
import { RcaService } from "./application/rca.service";
import { DatabaseRcaGovernanceSink } from "./domain/rca.governance";
import { AiModule } from "../../investigation/ai/ai.module";
import { BillingModule } from "../../platform/billing/billing.module";
import { LlmProviderResolver } from "../../investigation/ai/application/llm-provider.resolver";
import { RcaAnalysisRepository } from "./infrastructure/rca.repository";
import { RcaPersistenceService } from "./application/rca.persistence";
import { RcaApiService } from "./application/rca.api";
import { RcaController } from "./presentation/rca.controller";
import { TracesModule } from "../../telemetry/traces/traces.module";
import { TracesService } from "../../telemetry/traces/application/traces.service";
import { TraceRankingTelemetry } from "./infrastructure/rca.telemetry";

@Module({
  imports: [AiModule, BillingModule, TracesModule],
  controllers: [RcaController],
  providers: [
    RcaAnalysisRepository,
    RcaPersistenceService,
    RcaApiService,
    DatabaseRcaGovernanceSink,
    {
      provide: RcaService,
      useFactory: (resolver: LlmProviderResolver, traces: TracesService) =>
        new RcaService(resolver, new TraceRankingTelemetry(traces)),
      inject: [LlmProviderResolver, TracesService],
    },
  ],
  exports: [RcaApiService, DatabaseRcaGovernanceSink],
})
export class RcaModule {}
