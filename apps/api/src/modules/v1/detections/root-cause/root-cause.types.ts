/**
 * Root Cause Scoring Engine Types
 *
 * Defines the domain model for root cause ranking candidates and scoring signals.
 */

/**
 * A root cause candidate represents a service or operation that may be responsible
 * for an incident. Candidates are generated from correlated findings and ranked by
 * their likelihood of being the actual root cause.
 */
export interface RootCauseCandidate {
  /**
   * Unique identifier for this candidate
   */
  id: string;

  /**
   * Service name (required)
   */
  serviceName: string;

  /**
   * Operation or span name (optional, for operation-level candidates)
   */
  operationName?: string;

  /**
   * Type of candidate (service-level or operation-level)
   */
  candidateType: 'service' | 'operation';

  /**
   * Related finding IDs that contributed to this candidate
   */
  findingIds: string[];

  /**
   * Related trace IDs that provide evidence
   */
  traceIds: (string | undefined)[];

  /**
   * Dependency information (upstream/downstream relationships)
   */
  dependencies: {
    upstream: string[];
    downstream: string[];
  };

  /**
   * Time window of the anomaly
   */
  timeWindow: {
    start: string;
    end: string;
  };

  /**
   * Raw anomaly data (for signal extraction)
   */
  anomalyData: {
    observedValue?: number;
    baselineValue?: number;
    percentageDeviation?: number;
    severity?: 'warning' | 'critical';
    anomalyScore?: number;
  };
}

/**
 * Individual signal scores for a candidate
 */
export interface SignalScores {
  /**
   * Anomaly severity score [0, 1]
   */
  anomalySeverity: number;

  /**
   * Graph position and propagation score [0, 1]
   */
  graphPosition: number;

  /**
   * Critical-path contribution score [0, 1]
   */
  criticalPathContribution: number;

  /**
   * Error-propagation evidence score [0, 1]
   */
  errorPropagation: number;
}

/**
 * Evidence backing each signal score
 */
export interface SignalEvidence {
  /**
   * Evidence for anomaly severity
   */
  anomalySeverity: {
    deviationFromBaseline: number;
    severityLabel?: string;
    statisticalScore?: number;
  };

  /**
   * Evidence for graph position
   */
  graphPosition: {
    isUpstream: boolean;
    isDownstream: boolean;
    propagationOrder?: number;
    affectedDependents?: number;
    consistentPattern?: boolean;
  };

  /**
   * Evidence for critical-path contribution
   */
  criticalPathContribution: {
    spanDuration?: number;
    traceDuration?: number;
    contributionPercent?: number;
    isOnCriticalPath: boolean;
    frequencyInSlowTraces?: number;
  };

  /**
   * Evidence for error propagation
   */
  errorPropagation: {
    firstErrorTimestamp?: string;
    errorFrequency?: number;
    affectedTraces?: number;
    downstreamErrorsFollow?: boolean;
    consistentPattern?: boolean;
  };
}

/**
 * Ranked candidate with scores and evidence
 */
export interface RankedCandidate extends RootCauseCandidate {
  /**
   * Overall score [0, 1]
   */
  score: number;

  /**
   * Individual signal scores (may be partial if data missing)
   */
  signalScores: Partial<SignalScores>;

  /**
   * Evidence backing each signal (may be partial if data missing)
   */
  signalEvidence: Partial<SignalEvidence>;

  /**
   * Evidence coverage (how many signals had available data)
   */
  evidenceCoverage: number; // 0 to 4

  /**
   * Ranking limitations (why the score might be unreliable)
   */
  limitations: string[];
}

/**
 * Scoring weights configuration
 */
export interface ScoringWeights {
  anomalySeverity: number;
  graphPosition: number;
  criticalPathContribution: number;
  errorPropagation: number;
}

/**
 * Default scoring weights (from plan)
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  anomalySeverity: 0.30,
  graphPosition: 0.25,
  criticalPathContribution: 0.25,
  errorPropagation: 0.20,
};

/**
 * Ranking result with all candidates
 */
export interface RankingResult {
  /**
   * Ranked candidates (sorted by score descending)
   */
  candidates: RankedCandidate[];

  /**
   * Weights used for scoring
   */
  weights: ScoringWeights;

  /**
   * Overall evidence coverage across all candidates
   */
  overallEvidenceCoverage: number;

  /**
   * Ranking limitations
   */
  limitations: string[];
}
