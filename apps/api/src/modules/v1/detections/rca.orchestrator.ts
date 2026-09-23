import { Injectable } from '@nestjs/common';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaService } from './rca.service';
import type { RcaProviderResult } from './rca.types';

@Injectable()
export class RcaOrchestrator {
  constructor(private readonly rcaService: RcaService) {}

  async analyze(projectId: string, bottleneck: CorrelatedBottleneck): Promise<RcaProviderResult> {
    return this.rcaService.analyze(projectId, bottleneck);
  }
}
