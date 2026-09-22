import type { CorrelatedBottleneck } from './detection.correlation';
import { buildRcaEvidence } from './rca.evidence';
import type { RcaAnalysis, RcaProvider } from './rca.types';

export class RcaService {
  constructor(private readonly provider: RcaProvider) {}

  async analyze(
    projectId: string,
    bottleneck: CorrelatedBottleneck,
  ): Promise<RcaAnalysis> {
    const evidence = buildRcaEvidence(projectId, bottleneck);
    return this.provider.analyze(evidence);
  }
}
