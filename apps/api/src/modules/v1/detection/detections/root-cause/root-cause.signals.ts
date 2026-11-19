
import type {
  RootCauseCandidate,
  SignalScores,
  SignalEvidence,
} from './root-cause.types';

interface TraceSpan {
  spanId: string;
  serviceName: string;
  operationName?: string;
  duration: number;
  startTime: number;
  parentSpanId?: string;
  isCriticalPath?: boolean;
}

interface ErrorData {
  timestamp: string;
  serviceName: string;
  traceId: string;
  errorMessage: string;
}

export class SignalExtractor {
  extractSignals(
    candidate: RootCauseCandidate,
    traces: TraceSpan[][],
    errors: ErrorData[],
  ): { scores: Partial<SignalScores>; evidence: Partial<SignalEvidence> } {
    const anomalySeverity = this.extractAnomalySeverity(candidate);
    const hasDeps = candidate.dependencies.upstream.length > 0 || candidate.dependencies.downstream.length > 0;
    const graphPosition = hasDeps
      ? this.extractGraphPosition(candidate)
      : { score: undefined, evidence: undefined };
    const criticalPathContribution = traces.length > 0
      ? this.extractCriticalPathContribution(candidate, traces)
      : { score: undefined, evidence: undefined };
    const errorPropagation = errors.length > 0
      ? this.extractErrorPropagation(candidate, errors)
      : { score: undefined, evidence: undefined };

    const scores: Partial<SignalScores> = {
      anomalySeverity: anomalySeverity.score,
    };
    const evidence: Partial<SignalEvidence> = {
      anomalySeverity: anomalySeverity.evidence,
    };

    if (graphPosition.score !== undefined) {
      scores.graphPosition = graphPosition.score;
      evidence.graphPosition = graphPosition.evidence;
    }
    if (criticalPathContribution.score !== undefined) {
      scores.criticalPathContribution = criticalPathContribution.score;
      evidence.criticalPathContribution = criticalPathContribution.evidence;
    }
    if (errorPropagation.score !== undefined) {
      scores.errorPropagation = errorPropagation.score;
      evidence.errorPropagation = errorPropagation.evidence;
    }

    return { scores, evidence };
  }

  private extractAnomalySeverity(candidate: RootCauseCandidate): {
    score: number;
    evidence: SignalEvidence['anomalySeverity'];
  } {
    const { anomalyData } = candidate;

    let score = 0;

    if (anomalyData.percentageDeviation !== undefined) {
      score = Math.min(1, Math.max(0, anomalyData.percentageDeviation / 100));
    }

    if (anomalyData.severity === 'critical') {
      score = Math.min(1, score + 0.3);
    } else if (anomalyData.severity === 'warning') {
      score = Math.min(1, score + 0.1);
    }

    if (anomalyData.anomalyScore !== undefined) {
      score = Math.max(score, anomalyData.anomalyScore);
    }

    return {
      score: Math.min(1, Math.max(0, score)),
      evidence: {
        deviationFromBaseline: anomalyData.percentageDeviation || 0,
        severityLabel: anomalyData.severity,
        statisticalScore: anomalyData.anomalyScore,
      },
    };
  }

  private extractGraphPosition(candidate: RootCauseCandidate): {
    score: number;
    evidence: SignalEvidence['graphPosition'];
  } {
    const { dependencies } = candidate;
    let score = 0;

    if (dependencies.upstream.length === 0 && dependencies.downstream.length > 0) {
      score += 0.3;
    } else if (dependencies.upstream.length > 0 && dependencies.downstream.length === 0) {
      score -= 0.2;
    }

    const affectedDependents = dependencies.downstream.length;
    if (affectedDependents > 0) {
      score += Math.min(0.5, affectedDependents * 0.1);
    }

    return {
      score: Math.min(1, Math.max(0, score)),
      evidence: {
        isUpstream: dependencies.upstream.length > 0,
        isDownstream: dependencies.downstream.length > 0,
        affectedDependents,
        consistentPattern: false,
      },
    };
  }

  private extractCriticalPathContribution(
    candidate: RootCauseCandidate,
    allTraces: TraceSpan[][],
  ): {
    score: number;
    evidence: SignalEvidence['criticalPathContribution'];
  } {
    let score = 0;
    let totalDuration = 0;
    let criticalPathCount = 0;
    let traceCount = 0;

    for (const trace of allTraces) {
      const matchingSpans = trace.filter(
        (span) =>
          span.serviceName === candidate.serviceName &&
          (!candidate.operationName || span.operationName === candidate.operationName),
      );

      if (matchingSpans.length === 0) continue;

      traceCount++;

      const traceDuration = Math.max(...trace.map((s) => s.duration));
      totalDuration += traceDuration;

      const totalSpanDuration = matchingSpans.reduce((sum, span) => sum + span.duration, 0);

      const contributionPercent = totalSpanDuration / traceDuration;

      const isOnCriticalPath = matchingSpans.some((span) => span.isCriticalPath);
      if (isOnCriticalPath) criticalPathCount++;

      if (contributionPercent > 0.2) {
        score += contributionPercent;
      }
    }

    if (traceCount > 0) {
      score = score / traceCount;
    }

    if (traceCount > 0 && criticalPathCount / traceCount > 0.5) {
      score += 0.2;
    }

    return {
      score: Math.min(1, Math.max(0, score)),
      evidence: {
        spanDuration: undefined,
        traceDuration: traceCount > 0 ? totalDuration / traceCount : undefined,
        contributionPercent: undefined,
        isOnCriticalPath: criticalPathCount > 0,
        frequencyInSlowTraces: traceCount,
      },
    };
  }

  private extractErrorPropagation(
    candidate: RootCauseCandidate,
    errors: ErrorData[],
  ): {
    score: number;
    evidence: SignalEvidence['errorPropagation'];
  } {
    const candidateErrors = errors.filter(
      (error) => error.serviceName === candidate.serviceName,
    );

    if (candidateErrors.length === 0) {
      return {
        score: 0,
        evidence: {
          errorFrequency: 0,
          affectedTraces: 0,
          downstreamErrorsFollow: false,
          consistentPattern: false,
        },
      };
    }

    let score = 0;

    const errorFrequency = candidateErrors.length;
    score = Math.min(1, errorFrequency * 0.1);

    const allTimestamps = errors.map((e) => new Date(e.timestamp).getTime());
    const candidateTimestamps = candidateErrors.map((e) => new Date(e.timestamp).getTime());
    const earliestTimestamp = Math.min(...allTimestamps);
    const candidateEarliest = Math.min(...candidateTimestamps);

    if (candidateEarliest === earliestTimestamp) {
      score += 0.3;
    }

    const affectedTraces = new Set(candidateErrors.map((e) => e.traceId)).size;
    if (affectedTraces > 1) {
      score += 0.2;
    }

    return {
      score: Math.min(1, Math.max(0, score)),
      evidence: {
        firstErrorTimestamp: candidateErrors[0]?.timestamp,
        errorFrequency,
        affectedTraces,
        downstreamErrorsFollow: false,
        consistentPattern: affectedTraces > 1,
      },
    };
  }
}
