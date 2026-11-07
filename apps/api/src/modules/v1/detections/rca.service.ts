import type { CorrelatedBottleneck } from "./detection.correlation";
import { buildRcaEvidence } from "./rca.evidence";
import { validateRcaAnalysis } from "./rca.validation";
import type { RcaProviderResult } from "./rca.types";
import { MastraRcaProvider } from "./rca.provider";

export class RcaService {
  constructor(private readonly provider: MastraRcaProvider) {}

  async analyze(
    projectId: string,
    bottleneck: CorrelatedBottleneck,
  ): Promise<RcaProviderResult> {
    const evidence = buildRcaEvidence(projectId, bottleneck);
    const result = await this.provider.analyze(evidence);

    return {
      analysis: validateRcaAnalysis(result.analysis, evidence),
      usage: result.usage,
      promptVersion: result.promptVersion,
    };
  }
}
