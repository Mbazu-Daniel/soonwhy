import { Module } from '@nestjs/common';
import { RCA_PROVIDER } from './rca.tokens';
import { OpenAiCompatibleRcaProvider } from './rca.provider';
import { RcaService } from './rca.service';

@Module({
  providers: [
    RcaService,
    {
      provide: RCA_PROVIDER,
      useFactory: () => {
        const apiKey = process.env.SOONWHY_RCA_API_KEY;
        const model = process.env.SOONWHY_RCA_MODEL;
        const baseUrl = process.env.SOONWHY_RCA_BASE_URL;

        if (!apiKey || !model) {
          throw new Error(
            'SOONWHY_RCA_API_KEY and SOONWHY_RCA_MODEL are required when RCA is enabled',
          );
        }

        return new OpenAiCompatibleRcaProvider({
          apiKey,
          model,
          baseUrl,
        });
      },
    },
  ],
  exports: [RcaService],
})
export class RcaModule {}
