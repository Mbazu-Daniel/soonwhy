import { CandidateGenerator } from './root-cause.candidates';
import { SignalExtractor } from './root-cause.signals';
import { calculateScoreWithMissingSignals } from './root-cause.scorer';
import type { RankedCandidate, SignalScores, RankingResult } from './root-cause.types';
import { DEFAULT_WEIGHTS } from './root-cause.types';
import type { RankingInput } from "./root-cause.ranker.types";

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
      traces = [],
      errors = [],
      dependencyMap = new Map(),
      weights = DEFAULT_WEIGHTS,
    } = input;

    let candidates = this.candidateGenerator.generateFromFindings(findings);

    candidates = this.candidateGenerator.enrichWithDependencies(candidates, dependencyMap);

    const rankedCandidates: RankedCandidate[] = [];

    for (const candidate of candidates) {
      const { scores, evidence } = this.signalExtractor.extractSignals(candidate, traces, errors);

      const { score, availableSignals } = calculateScoreWithMissingSignals(scores, weights);

      rankedCandidates.push({
        ...candidate,
        score,
        signalScores: scores,
        signalEvidence: evidence,
        evidenceCoverage: availableSignals.length,
        limitations: this.calculateLimitations(scores, availableSignals),
      });
    }

    rankedCandidates.sort((a, b) => b.score - a.score);

    const totalSignals = rankedCandidates.reduce(
      (sum, candidate) => sum + candidate.evidenceCoverage,
      0,
    );
    const overallEvidenceCoverage = totalSignals / (rankedCandidates.length * 4);

    const limitations = this.collectLimitations(rankedCandidates);

    return {
      candidates: rankedCandidates,
      weights,
      overallEvidenceCoverage,
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
