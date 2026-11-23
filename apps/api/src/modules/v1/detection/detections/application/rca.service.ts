import type { CorrelatedBottleneck } from "../domain/detection.correlation.types";
import { buildRcaEvidence } from "../domain/rca.evidence";
import { validateRcaAnalysis } from "../domain/rca.validation";
import type { RcaAnalysisOutcome, RcaEvidence } from "../domain/rca.types";
import type { LlmCredentialSummary } from "../../../investigation/ai/application/llm-provider.resolver.types";
import { RootCauseRanker } from "../root-cause/root-cause.ranker";
import type { RcaModelResolver } from "./rca.service.types";
import { Logger } from "@nestjs/common";
import { MAX_RANKING_TRACES } from "../root-cause/root-cause.inputs.constants";
import { buildRankingInputs } from "../root-cause/root-cause.inputs";
import type { RankingTelemetry } from "../root-cause/root-cause.inputs.types";
import type { RankingInput } from "../root-cause/root-cause.ranker.types";

export class RcaService {
  private static readonly logger = new Logger(RcaService.name);
  private ranker: RootCauseRanker;

  constructor(
    private readonly resolver: RcaModelResolver,
    private readonly telemetry?: RankingTelemetry,
  ) {
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
      ...(await this.telemetryInputs(orgId, projectId, bottleneck.traceIds)),
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

  private async telemetryInputs(
    orgId: string,
    projectId: string,
    traceIds: string[],
  ): Promise<Pick<RankingInput, "traces" | "errors" | "errorsTotal" | "dependencyMap" | "traceLoad">> {
    const ids = [...new Set(traceIds)].slice(0, MAX_RANKING_TRACES);
    if (!this.telemetry || ids.length === 0) return {};
    try {
      const load = await this.telemetry.loadTraces(orgId, projectId, ids);
      return {
        ...buildRankingInputs(load.traces),
        traceLoad: { requested: load.requested, loaded: load.traces.length, failed: load.failed.length, notFound: load.notFound.length },
      };
    } catch (error) {
      RcaService.logger.warn(`Ranking without trace evidence: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }
}
