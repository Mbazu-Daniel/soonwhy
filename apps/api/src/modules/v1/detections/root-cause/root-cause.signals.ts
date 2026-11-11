/**
 * Root Cause Signal Extraction
 *
 * Extracts the four scoring signals from candidates and evidence.
 */

import type {
  RootCauseCandidate,
  SignalScores,
  SignalEvidence,
} from './root-cause.types';

/**
 * Trace span data for critical-path analysis
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
 * Error data for propagation analysis
 */
interface ErrorData {
  timestamp: string;
  serviceName: string;
  traceId: string;
  errorMessage: string;
}

/**
 * Extract all four signals for a candidate
 */
export class SignalExtractor {
  /**
   * Extract all signals for a candidate
   */
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

  /**
   * Signal A: Anomaly severity
   * Measures deviation from baseline
   */
  private extractAnomalySeverity(candidate: RootCauseCandidate): {
    score: number;
    evidence: SignalEvidence['anomalySeverity'];
  } {
    const { anomalyData } = candidate;

    // Start with baseline score
    let score = 0;

    // Percentage deviation contributes to score
    if (anomalyData.percentageDeviation !== undefined) {
      // Sigmoid-like normalization: 50% deviation = 0.5 score
      score = Math.min(1, Math.max(0, anomalyData.percentageDeviation / 100));
    }

    // Severity label adds weight
    if (anomalyData.severity === 'critical') {
      score = Math.min(1, score + 0.3);
    } else if (anomalyData.severity === 'warning') {
      score = Math.min(1, score + 0.1);
    }

    // Statistical anomaly score (if available)
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

  /**
   * Signal G: Graph position and propagation
   * Analyzes dependency graph and temporal relationships
   */
  private extractGraphPosition(candidate: RootCauseCandidate): {
    score: number;
    evidence: SignalEvidence['graphPosition'];
  } {
    const { dependencies } = candidate;
    let score = 0;

    // Upstream dependencies get higher score (likely root cause)
    if (dependencies.upstream.length === 0 && dependencies.downstream.length > 0) {
      // Leaf service with dependents - could be the cause
      score += 0.3;
    } else if (dependencies.upstream.length > 0 && dependencies.downstream.length === 0) {
      // Service with no dependents - unlikely to be root cause
      score -= 0.2;
    }

    // Services with many downstream dependents get higher score
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
        consistentPattern: false, // Would need trace data to determine
      },
    };
  }

  /**
   * Signal C: Critical-path contribution
   * Analyzes how much the candidate contributes to slow traces
   */
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
      // Find spans matching this candidate
      const matchingSpans = trace.filter(
        (span) =>
          span.serviceName === candidate.serviceName &&
          (!candidate.operationName || span.operationName === candidate.operationName),
      );

      if (matchingSpans.length === 0) continue;

      traceCount++;

      // Calculate total trace duration
      const traceDuration = Math.max(...trace.map((s) => s.duration));
      totalDuration += traceDuration;

      // Sum durations of matching spans
      const totalSpanDuration = matchingSpans.reduce((sum, span) => sum + span.duration, 0);

      // Calculate contribution percentage
      const contributionPercent = totalSpanDuration / traceDuration;

      // Check if on critical path
      const isOnCriticalPath = matchingSpans.some((span) => span.isCriticalPath);
      if (isOnCriticalPath) criticalPathCount++;

      // High contribution increases score
      if (contributionPercent > 0.2) {
        score += contributionPercent;
      }
    }

    // Normalize by number of traces
    if (traceCount > 0) {
      score = score / traceCount;
    }

    // Bonus for being on critical path frequently
    if (traceCount > 0 && criticalPathCount / traceCount > 0.5) {
      score += 0.2;
    }

    return {
      score: Math.min(1, Math.max(0, score)),
      evidence: {
        spanDuration: undefined, // Could be calculated from spans
        traceDuration: traceCount > 0 ? totalDuration / traceCount : undefined,
        contributionPercent: undefined,
        isOnCriticalPath: criticalPathCount > 0,
        frequencyInSlowTraces: traceCount,
      },
    };
  }

  /**
   * Signal E: Error-propagation evidence
   * Determines which candidate reports earliest errors
   */
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

    // Error frequency contributes to score
    const errorFrequency = candidateErrors.length;
    score = Math.min(1, errorFrequency * 0.1);

    // Check if this candidate has the earliest error
    const allTimestamps = errors.map((e) => new Date(e.timestamp).getTime());
    const candidateTimestamps = candidateErrors.map((e) => new Date(e.timestamp).getTime());
    const earliestTimestamp = Math.min(...allTimestamps);
    const candidateEarliest = Math.min(...candidateTimestamps);

    if (candidateEarliest === earliestTimestamp) {
      score += 0.3; // Bonus for earliest error
    }

    // Check if errors are consistent across traces
    const affectedTraces = new Set(candidateErrors.map((e) => e.traceId)).size;
    if (affectedTraces > 1) {
      score += 0.2; // Bonus for consistency
    }

    return {
      score: Math.min(1, Math.max(0, score)),
      evidence: {
        firstErrorTimestamp: candidateErrors[0]?.timestamp,
        errorFrequency,
        affectedTraces,
        downstreamErrorsFollow: false, // Would need dependency analysis
        consistentPattern: affectedTraces > 1,
      },
    };
  }
}
