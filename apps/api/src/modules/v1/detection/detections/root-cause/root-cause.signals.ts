
import { FULL_PERCENT, MAX_PER_TRACE_EVIDENCE } from './root-cause.constants';
import { analyzeErrorPropagation } from './root-cause.propagation';
import type { TraceSpan } from './root-cause.ranker.types';
import type {
  CriticalPathTraceEvidence,
  RootCauseCandidate,
  SignalScores,
  SignalEvidence,
} from './root-cause.types';

export class SignalExtractor {
  extractSignals(
    candidate: RootCauseCandidate,
    traces: TraceSpan[][],
  ): { scores: Partial<SignalScores>; evidence: Partial<SignalEvidence> } {
    const anomalySeverity = this.extractAnomalySeverity(candidate);
    const hasDeps = candidate.dependencies.upstream.length > 0 || candidate.dependencies.downstream.length > 0;
    const graphPosition = hasDeps
      ? this.extractGraphPosition(candidate)
      : { score: undefined, evidence: undefined };
    const inLoadedTrace = traces.some((trace) => trace.some((span) => span.serviceName === candidate.serviceName));
    const criticalPathContribution = inLoadedTrace
      ? this.extractCriticalPathContribution(candidate, traces)
      : { score: undefined, evidence: undefined };
    const propagation = inLoadedTrace ? analyzeErrorPropagation(candidate.serviceName, traces) : undefined;
    const errorPropagation = propagation ?? { score: undefined, evidence: undefined };

    const scores: Partial<SignalScores> = {};
    const evidence: Partial<SignalEvidence> = {};

    if (anomalySeverity.score !== undefined) {
      scores.anomalySeverity = anomalySeverity.score;
      evidence.anomalySeverity = anomalySeverity.evidence;
    }
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
    score: number | undefined;
    evidence: SignalEvidence['anomalySeverity'] | undefined;
  } {
    const { anomalyData } = candidate;

    if (
      anomalyData.percentageDeviation === undefined &&
      anomalyData.severity === undefined &&
      anomalyData.anomalyScore === undefined
    ) {
      return { score: undefined, evidence: undefined };
    }

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

  private selfTime(span: TraceSpan, trace: TraceSpan[]): number {
    const end = span.startTime + span.duration;
    const intervals = trace
      .filter((child) => child.parentSpanId === span.spanId)
      .map((child) => [Math.max(span.startTime, child.startTime), Math.min(end, child.startTime + child.duration)] as const)
      .filter(([from, to]) => to > from)
      .sort((a, b) => a[0] - b[0]);

    let covered = 0;
    let cursor = Number.NEGATIVE_INFINITY;
    for (const [from, to] of intervals) {
      const start = Math.max(from, cursor);
      if (to > start) {
        covered += to - start;
        cursor = to;
      }
    }
    return Math.max(0, span.duration - covered);
  }

  private extractCriticalPathContribution(
    candidate: RootCauseCandidate,
    allTraces: TraceSpan[][],
  ): {
    score: number | undefined;
    evidence: SignalEvidence['criticalPathContribution'] | undefined;
  } {
    let score = 0;
    let totalDuration = 0;
    let totalSelfTime = 0;
    let criticalPathCount = 0;
    const perTrace: CriticalPathTraceEvidence[] = [];

    for (const trace of allTraces) {
      const matchingSpans = trace.filter(
        (span) =>
          span.serviceName === candidate.serviceName &&
          (!candidate.operationName || span.operationName === candidate.operationName),
      );

      if (matchingSpans.length === 0) continue;

      const traceDuration = Math.max(...trace.map((s) => s.duration));
      totalDuration += traceDuration;

      const selfTimeMs = matchingSpans.reduce((sum, span) => sum + this.selfTime(span, trace), 0);
      totalSelfTime += selfTimeMs;

      const contributionPercent = selfTimeMs / traceDuration;

      const isOnCriticalPath = matchingSpans.some((span) => span.isCriticalPath);
      if (isOnCriticalPath) criticalPathCount++;

      if (contributionPercent > 0.2) {
        score += contributionPercent;
      }

      perTrace.push({
        traceId: matchingSpans[0]?.traceId,
        spanIds: matchingSpans.map((span) => span.spanId),
        selfTimeMs,
        traceDurationMs: traceDuration,
        percent: (selfTimeMs * FULL_PERCENT) / traceDuration,
        onCriticalPath: isOnCriticalPath,
      });
    }

    const traceCount = perTrace.length;
    if (traceCount === 0) return { score: undefined, evidence: undefined };

    score = score / traceCount;

    if (criticalPathCount / traceCount > 0.5) {
      score += 0.2;
    }

    const largestFirst = [...perTrace].sort(
      (a, b) => b.percent - a.percent || (a.traceId ?? '').localeCompare(b.traceId ?? ''),
    );

    return {
      score: Math.min(1, Math.max(0, score)),
      evidence: {
        spanDuration: totalSelfTime / traceCount,
        traceDuration: totalDuration / traceCount,
        contributionPercent: perTrace.reduce((sum, entry) => sum + entry.percent, 0) / traceCount,
        isOnCriticalPath: criticalPathCount > 0,
        frequencyInSlowTraces: traceCount,
        perTrace: largestFirst.slice(0, MAX_PER_TRACE_EVIDENCE),
      },
    };
  }
}
