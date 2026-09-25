import { Inject, Injectable } from '@nestjs/common';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaService } from './rca.service';
import type { RcaProviderResult } from './rca.types';

@Injectable()
export class RcaOrchestrator {
  constructor(@Inject(RcaService) private readonly rcaService: Pick<RcaService, 'analyze'>) {}

  async analyze(projectId: string, bottleneck: CorrelatedBottleneck): Promise<RcaProviderResult> {
    return this.rcaService.analyze(projectId, bottleneck);
  }
}
