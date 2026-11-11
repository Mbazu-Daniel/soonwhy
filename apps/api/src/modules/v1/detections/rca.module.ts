import { Module } from "@nestjs/common";
import { RcaService } from "./rca.service";
import { DatabaseRcaGovernanceSink } from "./rca.governance";
import { AiModule } from "../ai/ai.module";
import { LlmProviderResolver } from "../ai/llm-provider.resolver";

@Module({
  imports: [AiModule],
  providers: [
    DatabaseRcaGovernanceSink,
    {
      provide: RcaService,
      useFactory: (resolver: LlmProviderResolver) => new RcaService(resolver),
      inject: [LlmProviderResolver],
    },
  ],
  exports: [RcaService, DatabaseRcaGovernanceSink],
})
export class RcaModule {}
