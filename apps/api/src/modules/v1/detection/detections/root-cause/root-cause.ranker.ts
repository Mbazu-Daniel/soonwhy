import { CandidateGenerator } from './root-cause.candidates';
import { SignalExtractor } from './root-cause.signals';
import { confidenceTier, lowerTier } from './root-cause.confidence';
import { correctClockSkew } from './root-cause.clock-skew';
import { traceIntegrityLimitation } from './root-cause.trace-integrity';
import { loadedTooFewTraces, traceLoadLimitation } from './root-cause.trace-load';
import { calculateScoreWithMissingSignals, weightedCoverage } from './root-cause.scorer';
import type { RankedCandidate, SignalScores, RankingResult } from './root-cause.types';
import { DEFAULT_WEIGHTS } from './root-cause.types';
import type { RankingInput } from "./root-cause.ranker.types";

const PROPAGATION_SCOPE_LIMITATION =
  'Error propagation follows parent spans within one trace; queue and async links between traces are not followed';

export class RootCauseRanker {
  private candidateGenerator: CandidateGenerator;
  private signalExtractor: SignalExtractor;

  constructor() {
    this.candidateGenerator = new CandidateGenerator();
    this.signalExtractor = new SignalExtractor();
  }

  rank(input: RankingInput): RankingResult {
    const {
      findings,
      traces: observedTraces = [],
      errors = [],
      errorsTotal,
      traceLoad,
      dependencyMap = new Map(),
      weights = DEFAULT_WEIGHTS,
    } = input;

    const { traces, offsets } = correctClockSkew(observedTraces);
    let candidates = this.candidateGenerator.generateFromFindings(findings);

    candidates = this.candidateGenerator.enrichWithDependencies(candidates, dependencyMap);

    const rankedCandidates: RankedCandidate[] = [];
    const integrityLimitation = traceIntegrityLimitation(traces);
    const dropTier = loadedTooFewTraces(traceLoad) || integrityLimitation !== undefined;

    for (const candidate of candidates) {
      const { scores, evidence } = this.signalExtractor.extractSignals(candidate, traces);

      const { score, availableSignals } = calculateScoreWithMissingSignals(scores, weights);

      rankedCandidates.push({
        ...candidate,
        score,
        signalScores: scores,
        signalEvidence: evidence,
        evidenceCoverage: weightedCoverage(availableSignals, weights),
        confidence: dropTier ? lowerTier(confidenceTier(score)) : confidenceTier(score),
        limitations: this.calculateLimitations(scores, availableSignals),
      });
    }

    rankedCandidates.sort(
      (a, b) =>
        b.score - a.score ||
        a.serviceName.localeCompare(b.serviceName) ||
        (a.operationName ?? '').localeCompare(b.operationName ?? ''),
    );

    const overallEvidenceCoverage =
      rankedCandidates.length === 0
        ? 0
        : rankedCandidates.reduce((sum, candidate) => sum + candidate.evidenceCoverage, 0) / rankedCandidates.length;

    const limitations = this.collectLimitations(rankedCandidates);
    if (rankedCandidates.some((candidate) => candidate.signalEvidence.errorPropagation)) {
      limitations.push(PROPAGATION_SCOPE_LIMITATION);
    }
    const loadLimitation = traceLoadLimitation(traceLoad);
    if (loadLimitation) limitations.push(loadLimitation);
    if (integrityLimitation) limitations.push(integrityLimitation);
    if (offsets.size > 0) limitations.push(`Service clocks disagreed; timestamps were adjusted by up to ${Math.round(Math.max(...[...offsets.values()].map(Math.abs)))} ms`);
    if (errorsTotal !== undefined && errorsTotal > errors.length) {
      limitations.push(`Error list truncated: ${errors.length.toLocaleString('en-US')} of ${errorsTotal.toLocaleString('en-US')}`);
    }

    return {
      candidates: rankedCandidates,
      weights,
      overallEvidenceCoverage,
      confidence: rankedCandidates[0]?.confidence ?? 'low',
      limitations,
    };
  }

  private calculateLimitations(
    scores: Partial<SignalScores>,
    availableSignals: string[],
  ): string[] {
    const limitations: string[] = [];

    if (!availableSignals.includes('anomalySeverity')) {
      limitations.push('Missing anomaly severity data');
    }
    if (!availableSignals.includes('graphPosition')) {
      limitations.push('Missing dependency graph data');
    }
    if (!availableSignals.includes('criticalPathContribution')) {
      limitations.push('Missing trace data for critical-path analysis');
    }
    if (!availableSignals.includes('errorPropagation')) {
      limitations.push('Missing error data for propagation analysis');
    }

    return limitations;
  }

  private collectLimitations(candidates: RankedCandidate[]): string[] {
    const uniqueLimitations = new Set<string>();

    for (const candidate of candidates) {
      for (const limitation of candidate.limitations) {
        uniqueLimitations.add(limitation);
      }
    }

    return Array.from(uniqueLimitations);
  }
}
