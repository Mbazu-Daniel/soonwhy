import { Inject, Injectable } from '@nestjs/common';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaService } from './rca.service';
import { RCA_PROVIDER } from './rca.tokens';
import type { RcaAnalysis, RcaProvider } from './rca.types';

@Injectable()
export class RcaOrchestrator {
  constructor(
    private readonly rcaService: RcaService,
    @Inject(RCA_PROVIDER) private readonly provider: RcaProvider,
  ) {}

  async analyze(
    projectId: string,
    bottleneck: CorrelatedBottleneck,
  ): Promise<RcaAnalysis> {
    return this.rcaService.analyze(projectId, bottleneck);
  }

  isConfigured(): boolean {
    return Boolean(this.provider);
  }
}
