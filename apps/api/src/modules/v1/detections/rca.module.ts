import { Module } from '@nestjs/common';
import { RcaService } from './rca.service';
import { DisabledRcaProvider, OpenAiCompatibleRcaProvider } from './rca.provider';
import { RCA_PROVIDER } from './rca.tokens';
import { RCA_PROMPT_VERSION } from './rca.prompt';
import { DatabaseRcaGovernanceSink } from './rca.governance';

@Module({
  providers: [
    {
      provide: RCA_PROVIDER,
      useFactory: () => {
        const apiKey = process.env.SOONWHY_RCA_API_KEY;
        const model = process.env.SOONWHY_RCA_MODEL;

        if (!apiKey || !model) return new DisabledRcaProvider();

        return new OpenAiCompatibleRcaProvider({
          apiKey,
          model,
          baseUrl: process.env.SOONWHY_RCA_BASE_URL,
          timeoutMs: Number(process.env.SOONWHY_RCA_TIMEOUT_MS) || undefined,
          maxPromptCharacters: Number(process.env.SOONWHY_RCA_MAX_PROMPT_CHARACTERS) || undefined,
          maxRetries: Number(process.env.SOONWHY_RCA_MAX_RETRIES) || undefined,
          inputCostPerMillionTokensUsd: Number(process.env.SOONWHY_RCA_INPUT_COST_PER_MILLION_TOKENS_USD) || undefined,
          outputCostPerMillionTokensUsd: Number(process.env.SOONWHY_RCA_OUTPUT_COST_PER_MILLION_TOKENS_USD) || undefined,
          promptVersion: process.env.SOONWHY_RCA_PROMPT_VERSION ?? RCA_PROMPT_VERSION,
        });
      },
    },
    DatabaseRcaGovernanceSink,
    {
      provide: RcaService,
      useFactory: (provider: import('./rca.types').RcaProvider) => new RcaService(provider),
      inject: [RCA_PROVIDER],
    },
  ],
  exports: [RcaService],
})
export class RcaModule {}
