import type { CorrelatedBottleneck } from './detection.correlation';
import { buildRcaEvidence } from './rca.evidence';
import { validateRcaAnalysis } from './rca.validation';
import type { RcaProvider, RcaProviderResult } from './rca.types';

export class RcaService {
  constructor(private readonly provider: RcaProvider) {}

  async analyze(
    projectId: string,
    bottleneck: CorrelatedBottleneck,
  ): Promise<RcaProviderResult> {
    const evidence = buildRcaEvidence(projectId, bottleneck);
    const result = await this.provider.analyze(evidence);
    const analysis = validateRcaAnalysis(result.analysis, evidence);
    return { analysis, usage: result.usage };
  }
}
