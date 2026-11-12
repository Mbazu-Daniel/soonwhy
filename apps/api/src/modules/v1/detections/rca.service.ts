import type { CorrelatedBottleneck } from "./detection.correlation";
import { buildRcaEvidence } from "./rca.evidence";
import { validateRcaAnalysis } from "./rca.validation";
import type { RcaAnalysisOutcome, RcaCredentialInfo } from "./rca.types";
import type { MastraRcaProvider } from "./rca.provider";
import type { LlmCredentialSummary } from "../ai/llm-provider.resolver";
import { RootCauseRanker } from "./root-cause/root-cause.ranker";

export interface RcaModelHandle {
  readonly provider: Pick<MastraRcaProvider, "analyze">;
  readonly credential: RcaCredentialInfo;
  readonly promptVersion: string;
}

export interface RcaModelResolver {
  resolveForRca(orgId: string): Promise<RcaModelHandle>;
  describe(orgId: string): Promise<LlmCredentialSummary>;
}

export class RcaService {
  private ranker: RootCauseRanker;

  constructor(private readonly resolver: RcaModelResolver) {
    this.ranker = new RootCauseRanker();
  }

  /** Which credential would serve this org, known before any tokens are spent. */
  describe(orgId: string): Promise<LlmCredentialSummary> {
    return this.resolver.describe(orgId);
  }

  async analyze(
    orgId: string,
    projectId: string,
    bottleneck: CorrelatedBottleneck,
  ): Promise<RcaAnalysisOutcome> {
    const { provider, credential } =
      await this.resolver.resolveForRca(orgId);

    // Generate root cause ranking
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
