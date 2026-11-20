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

@Module({
  imports: [AiModule, BillingModule],
  controllers: [RcaController],
  providers: [
    RcaAnalysisRepository,
    RcaPersistenceService,
    RcaApiService,
    DatabaseRcaGovernanceSink,
    {
      provide: RcaService,
      useFactory: (resolver: LlmProviderResolver) => new RcaService(resolver),
      inject: [LlmProviderResolver],
    },
  ],
  exports: [RcaApiService, DatabaseRcaGovernanceSink],
})
export class RcaModule {}
