import type { CorrelatedBottleneck } from "./detection.correlation";
import { buildRcaEvidence } from "./rca.evidence";
import { validateRcaAnalysis } from "./rca.validation";
import type { RcaAnalysisOutcome, RcaCredentialInfo, RcaEvidence } from "./rca.types";
import type { MastraRcaProvider } from "./rca.provider";
import type { LlmCredentialSummary } from "../ai/llm-provider.resolver";
import { RootCauseRanker } from "./root-cause/root-cause.ranker";

export interface RcaModelHandle {
  readonly provider: Pick<MastraRcaProvider, "analyze">;
  readonly credential: RcaCredentialInfo;
  readonly promptVersion: string;
}

export interface RcaModelResolver {
  resolveForRca(orgId: string, credentialId?: string): Promise<RcaModelHandle>;
  describe(orgId: string): Promise<LlmCredentialSummary>;
}

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
        ...bottleneck.supportingFindings.map(f => ({ ...f, timestamp: (f as any).timestamp || bottleneck.latency.window.start.toISOString() })),
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
