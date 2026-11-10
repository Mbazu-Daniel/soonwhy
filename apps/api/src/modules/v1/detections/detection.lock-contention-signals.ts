import { detectDatabaseLockContention } from '../intelligence/database-lock-contention.detector';
import { type DatabaseQueryTrace } from '../intelligence/database-query.detector';
import type { DetectionStageContext, DetectionStageDeps } from './detection.stage';
import type { DetectionFinding } from './detection.types';

export async function detectLockContentionSignals(
  deps: DetectionStageDeps,
  context: DetectionStageContext,
  detected: DetectionFinding[],
  currentDatabaseSpans: DatabaseQueryTrace[],
): Promise<void> {
  const {
    orgId, projectId, start, end, detectorEnabled,
  } = context;
  for (const candidate of detectorEnabled('database_lock_contention') ? detectDatabaseLockContention(currentDatabaseSpans) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_lock_contention',
      type: 'database_lock_contention',
      severity: candidate.signal.confidence === 'high' ? 'critical' : 'warning',
      title: 'Database lock contention in ' + candidate.serviceName,
      description: candidate.query + ' shows database lock contention across ' +
        candidate.signal.sampleCount + ' spans with ' +
        candidate.signal.lockErrorCount + ' lock errors.',
      observedValue: candidate.signal.p95Duration,
      threshold: 250,
      unit: 'ms',
      start,
      end,
      evidence: [
        ...candidate.samples.map((sample) => ({
          kind: 'metric' as const,
          label: 'database-lock-sample',
          value: sample.duration,
          context: {
            service: sample.service,
            traceId: sample.traceId,
            spanId: sample.spanId,
            timestamp: sample.timestamp,
            ...(sample.statusMessage ? { statusMessage: sample.statusMessage } : {}),
            ...(sample.errorType ? { errorType: sample.errorType } : {}),
            dbQueryText: sample.dbQueryText ?? candidate.query,
          },
        })),
        {
          kind: 'metric' as const,
          label: 'database-lock-profile',
          value: candidate.signal.p95Duration,
          context: {
            query: candidate.query,
            ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
            ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
            ...(candidate.databaseSystem ? { databaseSystem: candidate.databaseSystem } : {}),
            ...(candidate.collectionName ? { collectionName: candidate.collectionName } : {}),
            sampleCount: candidate.signal.sampleCount,
            p50: candidate.signal.p50Duration,
            p95: candidate.signal.p95Duration,
            p99: candidate.signal.p99Duration,
            lockErrorCount: candidate.signal.lockErrorCount,
            lockErrorRate: candidate.signal.lockErrorRate,
            lockQueryCount: candidate.signal.lockQueryCount,
            lockQueryRate: candidate.signal.lockQueryRate,
            overlappingPairCount: candidate.signal.overlappingPairCount,
            contentionSignals: candidate.signal.contentionSignals.join(','),
            confidence: candidate.signal.confidence,
            fingerprint: candidate.identity.fingerprint,
            fingerprintVersion: candidate.identity.fingerprintVersion,
          },
        },
        {
          kind: 'recommendation' as const,
          label: 'database-lock-guidance',
          value: candidate.recommendation,
          context: {
            ...(candidate.databaseSystem ? { databaseSystem: candidate.databaseSystem } : {}),
            query: candidate.query,
          },
        },
      ],
    }));
  }}
