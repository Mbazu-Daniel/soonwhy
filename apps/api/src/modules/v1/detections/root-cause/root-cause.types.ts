
export interface RootCauseCandidate {
  id: string;

  serviceName: string;

  operationName?: string;

  candidateType: 'service' | 'operation';

  findingIds: string[];

  traceIds: (string | undefined)[];

  dependencies: {
    upstream: string[];
    downstream: string[];
  };

  timeWindow: {
    start: string;
    end: string;
  };

  anomalyData: {
    observedValue?: number;
    baselineValue?: number;
    percentageDeviation?: number;
    severity?: 'warning' | 'critical';
    anomalyScore?: number;
  };
}

export interface SignalScores {
  anomalySeverity: number;

  graphPosition: number;

  criticalPathContribution: number;

  errorPropagation: number;
}

export interface SignalEvidence {
  anomalySeverity: {
    deviationFromBaseline: number;
    severityLabel?: string;
    statisticalScore?: number;
  };

  graphPosition: {
    isUpstream: boolean;
    isDownstream: boolean;
    propagationOrder?: number;
    affectedDependents?: number;
    consistentPattern?: boolean;
  };

  criticalPathContribution: {
    spanDuration?: number;
    traceDuration?: number;
    contributionPercent?: number;
    isOnCriticalPath: boolean;
    frequencyInSlowTraces?: number;
  };

  errorPropagation: {
    firstErrorTimestamp?: string;
    errorFrequency?: number;
    affectedTraces?: number;
    downstreamErrorsFollow?: boolean;
    consistentPattern?: boolean;
  };
}

export interface RankedCandidate extends RootCauseCandidate {
  score: number;

  signalScores: Partial<SignalScores>;

  signalEvidence: Partial<SignalEvidence>;

  evidenceCoverage: number;

  limitations: string[];
}

export interface ScoringWeights {
  anomalySeverity: number;
  graphPosition: number;
  criticalPathContribution: number;
  errorPropagation: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  anomalySeverity: 0.30,
  graphPosition: 0.25,
  criticalPathContribution: 0.25,
  errorPropagation: 0.20,
};

export interface RankingResult {
  candidates: RankedCandidate[];

  weights: ScoringWeights;

  overallEvidenceCoverage: number;

  limitations: string[];
}
