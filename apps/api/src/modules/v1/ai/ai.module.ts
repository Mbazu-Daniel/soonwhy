import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiRepository } from "./ai.repository";
import { AiService } from "./ai.service";
import { CredentialCipher } from "./credential-cipher";
import { LlmCatalog } from "./llm-catalog.service";
import { LlmProviderResolver } from "./llm-provider.resolver";
import { BillingModule } from "../billing/billing.module";

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
