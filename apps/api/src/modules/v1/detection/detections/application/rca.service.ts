import type { CorrelatedBottleneck } from "../domain/detection.correlation.types";
import { buildRcaEvidence } from "../domain/rca.evidence";
import { validateRcaAnalysis } from "../domain/rca.validation";
import type { RcaAnalysisOutcome, RcaEvidence } from "../domain/rca.types";
import type { LlmCredentialSummary } from "../../../investigation/ai/application/llm-provider.resolver.types";
import { RootCauseRanker } from "../root-cause/root-cause.ranker";
import type { RcaModelResolver } from "./rca.service.types";

export class RcaService {
  private ranker: RootCauseRanker;

  constructor(private readonly resolver: RcaModelResolver) {
    this.ranker = new RootCauseRanker();
  }

  describe(orgId: string): Promise<LlmCredentialSummary> {
    return this.resolver.describe(orgId);
  }

  async analyzeEvidence(
    orgId: string,
    evidence: RcaEvidence,
    credentialId?: string,
  ): Promise<RcaAnalysisOutcome> {
    const { provider, credential } = await this.resolver.resolveForRca(orgId, credentialId);
    const result = await provider.analyze(evidence);
    return {
      analysis: validateRcaAnalysis(result.analysis, evidence),
      usage: result.usage,
      promptVersion: result.promptVersion,
      credential,
      evidence,
    };
  }

  async analyze(
    orgId: string,
    projectId: string,
    bottleneck: CorrelatedBottleneck,
    credentialId?: string,
  ): Promise<RcaAnalysisOutcome> {
    const { provider, credential } =
      await this.resolver.resolveForRca(orgId, credentialId);

    const rankingResult = this.ranker.rank({
      findings: [
        { ...bottleneck.latency, timestamp: bottleneck.latency.window.start.toISOString() },
        ...bottleneck.supportingFindings.map(f => ({ ...f, timestamp: f.window.start.toISOString() })),
      ],
    });

    const evidence = buildRcaEvidence(projectId, bottleneck, rankingResult);
    const result = await provider.analyze(evidence);

    return {
      analysis: validateRcaAnalysis(result.analysis, evidence),
      usage: result.usage,
      promptVersion: result.promptVersion,
      credential,
      evidence,
    };
  }
}
