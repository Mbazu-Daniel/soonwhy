import { Module } from "@nestjs/common";
import { AiController } from "./presentation/ai.controller";
import { AiRepository } from "./infrastructure/ai.repository";
import { AiService } from "./application/ai.service";
import { CredentialCipher } from "./domain/credential-cipher";
import { LlmCatalog } from "./application/llm-catalog.service";
import { LlmProviderResolver } from "./application/llm-provider.resolver";
import { BillingModule } from "../../platform/billing/billing.module";

@Module({
  imports: [BillingModule],
  controllers: [AiController],
  providers: [
    AiRepository,
    { provide: CredentialCipher, useFactory: () => CredentialCipher.fromEnv() },
    LlmCatalog,
    LlmProviderResolver,
    AiService,
  ],
  exports: [AiService, CredentialCipher, LlmCatalog, LlmProviderResolver],
})
export class AiModule {}
