import { Module } from "@nestjs/common";
import { RcaService } from "./rca.service";
import { DatabaseRcaGovernanceSink } from "./rca.governance";
import { AiModule } from "../ai/ai.module";
import { BillingModule } from "../billing/billing.module";
import { LlmProviderResolver } from "../ai/llm-provider.resolver";
import { RcaAnalysisRepository } from "./rca.repository";
import { RcaPersistenceService } from "./rca.persistence";
import { RcaApiService } from "./rca.api";
import { RcaController } from "./rca.controller";

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
  exports: [RcaService, RcaApiService, DatabaseRcaGovernanceSink],
})
export class RcaModule {}
