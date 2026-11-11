/**
 * Root Cause Ranker
 *
 * Main ranking engine that generates candidates, extracts signals,
 * calculates scores, and returns ranked results.
 */

import { CandidateGenerator } from './root-cause.candidates';
import { SignalExtractor } from './root-cause.signals';
import { calculateScoreWithMissingSignals } from './root-cause.scorer';
import type {
  RankedCandidate,
  ScoringWeights,
  SignalScores,
  RankingResult,
} from './root-cause.types';
import { DEFAULT_WEIGHTS } from './root-cause.types';

/**
 * Trace span data
 */
interface TraceSpan {
  spanId: string;
  serviceName: string;
  operationName?: string;
  duration: number;
  startTime: number;
  parentSpanId?: string;
  isCriticalPath?: boolean;
}

/**
 * Error data
 */
interface ErrorData {
  timestamp: string;
  serviceName: string;
  traceId: string;
  errorMessage: string;
}

/**
 * Input data for ranking
 */
export interface RankingInput {
  findings: Array<{
    id: string;
    type: string;
    serviceName: string;
    operationName?: string;
    traceId?: string;
    timestamp: string;
    severity?: 'warning' | 'critical';
    observedValue?: number;
    baselineValue?: number;
    threshold?: number;
    data?: Record<string, unknown>;
  }>;
  traces?: TraceSpan[][];
  errors?: ErrorData[];
  dependencyMap?: Map<string, { upstream: string[]; downstream: string[] }>;
  weights?: ScoringWeights;
}

/**
 * Root Cause Ranker
 */
export class RootCauseRanker {
  private candidateGenerator: CandidateGenerator;
  private signalExtractor: SignalExtractor;

  constructor() {
    this.candidateGenerator = new CandidateGenerator();
    this.signalExtractor = new SignalExtractor();
  }

  /**
   * Rank root cause candidates from findings and evidence
   */
  rank(input: RankingInput): RankingResult {
    const {
      findings,
      traces = [],
      errors = [],
      dependencyMap = new Map(),
      weights = DEFAULT_WEIGHTS,
    } = input;

    // Phase 1: Generate candidates
    let candidates = this.candidateGenerator.generateFromFindings(findings);

    // Enrich with dependency information
    candidates = this.candidateGenerator.enrichWithDependencies(candidates, dependencyMap);

    // Phase 2: Extract signals and calculate scores
    const rankedCandidates: RankedCandidate[] = [];

    for (const candidate of candidates) {
      const { scores, evidence } = this.signalExtractor.extractSignals(candidate, traces, errors);

      // Calculate score (handles missing signals)
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

    // Phase 3: Sort by score descending
    rankedCandidates.sort((a, b) => b.score - a.score);

    // Calculate overall evidence coverage
    const totalSignals = rankedCandidates.reduce(
      (sum, candidate) => sum + candidate.evidenceCoverage,
      0,
    );
    const overallEvidenceCoverage = totalSignals / (rankedCandidates.length * 4);

    // Collect limitations
    const limitations = this.collectLimitations(rankedCandidates);

    return {
      candidates: rankedCandidates,
      weights,
      overallEvidenceCoverage,
      limitations,
    };
  }

  /**
   * Calculate limitations for a candidate based on missing signals
   */
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

  /**
   * Collect all limitations across candidates
   */
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
