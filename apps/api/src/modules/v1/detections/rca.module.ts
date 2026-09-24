import { Module } from '@nestjs/common';
import { RcaService } from './rca.service';
import { DisabledRcaProvider, OpenAiCompatibleRcaProvider } from './rca.provider';
import { RCA_PROVIDER } from './rca.tokens';

@Module({
  providers: [
    {
      provide: RCA_PROVIDER,
      useFactory: () => {
        const apiKey = process.env.SOONWHY_RCA_API_KEY;
        const model = process.env.SOONWHY_RCA_MODEL;
        if (!apiKey || !model) return new DisabledRcaProvider();
        return new OpenAiCompatibleRcaProvider({ apiKey, model, baseUrl: process.env.SOONWHY_RCA_BASE_URL });
      },
    },
    {
      provide: RcaService,
      useFactory: (provider: import('./rca.types').RcaProvider) => new RcaService(provider),
      inject: [RCA_PROVIDER],
    },
  ],
  exports: [RcaService],
})
export class RcaModule {}
