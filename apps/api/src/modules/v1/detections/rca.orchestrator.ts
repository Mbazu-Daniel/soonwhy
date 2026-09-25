import { Injectable } from '@nestjs/common';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaService } from './rca.service';
import type { RcaAnalysis } from './rca.types';

@Injectable()
export class RcaOrchestrator {
  constructor(private readonly rcaService: Pick<RcaService, 'analyze'>) {}

  async analyze(projectId: string, bottleneck: CorrelatedBottleneck): Promise<RcaAnalysis> {
    return this.rcaService.analyze(projectId, bottleneck);
  }
}
