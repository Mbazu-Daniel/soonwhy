import { QUICKWIT_INDEXES } from '@soonwhy/shared';
import { quickwitTenantQuery } from '../../../common/quickwit/query';
import { detectDatabaseQueries, type DatabaseQueryTrace } from '../intelligence/database-query.detector';
import { detectDatabaseQueryVolume, type DatabaseQueryVolumeTrace } from '../intelligence/database-query-volume.detector';
import { detectDatabaseErrors, type DatabaseErrorTrace } from '../intelligence/database-error.detector';
import { detectDatabaseLatencyContribution, type DatabaseLatencyContributionTrace } from '../intelligence/database-latency-contribution.detector';
import { detectDatabaseConnectionPool, type DatabaseConnectionPoolSample } from '../intelligence/database-connection-pool.detector';
import { detectDatabaseTimeouts, type DatabaseTimeoutTrace } from '../intelligence/database-timeout.detector';
import { detectDatabaseResultSets, type DatabaseResultSetTrace } from '../intelligence/database-result-set.detector';
import { detectDatabaseConnectionWait } from '../intelligence/database-connection-wait.detector';
import { detectDatabaseBatches, type DatabaseBatchTrace } from '../intelligence/database-batch.detector';
import { detectDatabaseDependencyDegradation, type DatabaseDependencyTrace } from '../intelligence/database-dependency-degradation.detector';
import { detectNPlusOne, type NPlusOneTrace } from '../intelligence/n-plus-one.detector';
import { searchDatabaseConnectionPoolMetrics, searchDatabaseConnectionWaitMetrics, searchDatabaseQuerySpans, searchRequestEndpoints } from './detection-search.methods';
import {
  describeDatabaseBatch,
  describeDatabaseConnectionPool,
  describeDatabaseConnectionWait,
  describeDatabaseError,
  describeDatabaseLatencyContribution,
  describeDatabaseQuery,
  describeDatabaseQueryVolume,
  describeDatabaseResultSet,
  describeDatabaseTimeout,
  describeNPlusOne,
} from './detection-description.methods';
import { WINDOW_MS, type DetectionStageContext, type DetectionStageDeps } from './detection.stage';
import type { DetectionFinding, TraceSource } from './detection.types';

export type DatabaseSignalDeps = DetectionStageDeps;

export async function detectDatabaseSignals(
  deps: DatabaseSignalDeps,
  context: DetectionStageContext,
  detected: DetectionFinding[],
): Promise<DatabaseQueryTrace[]> {
  const {
    orgId, projectId, start, end, startTimestamp, endTimestamp,
    detectorEnabled,
  } = context;
  const enabledDatabaseDetectors = [
    'database_query',
    'database_latency_contribution',
    'database_batch',
    'database_dependency_degradation',
    'database_timeout',
    'database_result_set',
    'database_error',
    'database_query_volume',
    'database_n_plus_one',
    'database_lock_contention',
  ].some(detectorEnabled);

  const noDatabaseSpans: DatabaseQueryTrace[] = [];
  const [currentDatabaseSpans, baselineDatabaseSpans] = enabledDatabaseDetectors
    ? await Promise.all([
      cachedDatabaseQuerySpans(deps, orgId, projectId, startTimestamp, endTimestamp),
      cachedDatabaseQuerySpans(deps, 
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ])
    : [noDatabaseSpans, noDatabaseSpans];

  for (const candidate of detectorEnabled('database_query') ? detectDatabaseQueries(currentDatabaseSpans, baselineDatabaseSpans) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_query',
      type: 'database_query',
      severity: candidate.signal.severity ?? 'warning',
      title: 'Slow database query in ' + candidate.serviceName,
      description: describeDatabaseQuery(candidate),
      observedValue: candidate.signal.observedValue,
      threshold: candidate.signal.threshold,
      unit: 'ms',
      start,
      end,
      evidence: candidate.samples.map((sample) => ({
        kind: 'trace',
        label: 'database-query-span',
        value: sample.duration,
        context: {
          service: sample.service,
          traceId: sample.traceId,
          spanId: sample.spanId,
          timestamp: sample.timestamp,
          fingerprint: candidate.identity.fingerprint,
          databaseSystem: candidate.databaseSystem ?? '',
          dependencyName: sample.dependencyName,
          ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
          ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
          ...(candidate.collectionName ? { collectionName: candidate.collectionName } : {}),
          ...(sample.dbQueryText ? { query: sample.dbQueryText } : {}),
          ...(sample.dbReturnedRows !== undefined ? { returnedRows: sample.dbReturnedRows } : {}),
        },
      })),
    }));
  }

  const enabledTraceDurations = [
    'database_latency_contribution',
    'database_batch',
    'database_result_set',
  ].some(detectorEnabled);
  const traceDurations = enabledTraceDurations
    ? await cachedTraceDurations(deps, 
      orgId,
      projectId,
      startTimestamp,
      endTimestamp,
    )
    : new Map<string, number>();

  const databaseLatencyContributionTraces: DatabaseLatencyContributionTrace[] = currentDatabaseSpans.flatMap((sample) => {
    const traceDuration = traceDurations.get(sample.traceId);
    if (traceDuration === undefined) return [];

    return [{
      timestamp: sample.timestamp,
      service: sample.service,
      traceId: sample.traceId,
      spanId: sample.spanId,
      duration: sample.duration,
      traceDuration,
      dependencyType: sample.dependencyType,
      dependencyName: sample.dependencyName,
      ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
      ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
      ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
      ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
      ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
    }];
  });

  for (const candidate of detectorEnabled('database_latency_contribution') ? detectDatabaseLatencyContribution(databaseLatencyContributionTraces) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_latency_contribution',
      type: 'database_latency_contribution',
      severity: candidate.signal.p95ContributionPercent >= 75 ? 'critical' : 'warning',
      title: 'Database latency dominates traces in ' + candidate.serviceName,
      description: describeDatabaseLatencyContribution(candidate),
      observedValue: candidate.signal.p95ContributionPercent,
      threshold: 50,
      unit: '% of trace duration',
      start,
      end,
      evidence: candidate.samples.map((sample) => ({
        kind: 'trace' as const,
        label: 'database-latency-contribution',
        value: sample.duration,
        context: {
          service: sample.service,
          traceId: sample.traceId,
          spanId: sample.spanId,
          traceDurationMs: sample.traceDuration,
          contributionPercent: (sample.duration / sample.traceDuration) * 100,
          fingerprint: candidate.identity.fingerprint,
          databaseSystem: candidate.databaseSystem ?? '',
          dependencyName: sample.dependencyName,
          ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
          ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
          ...(sample.dbQueryText ? { query: sample.dbQueryText } : {}),
        },
      })),
    }));
  }

  const enabledPoolMetrics = detectorEnabled('database_connection_pool') || detectorEnabled('database_dependency_degradation');
  const databasePoolMetrics = enabledPoolMetrics
    ? await cachedDatabaseConnectionPoolMetrics(deps, 
      orgId,
      projectId,
      startTimestamp,
      endTimestamp,
    )
    : [];

  for (const candidate of detectorEnabled('database_connection_pool') ? detectDatabaseConnectionPool(databasePoolMetrics) : []) {
    const observed = candidate.signal.p95PendingRequests !== undefined
      ? { value: candidate.signal.p95PendingRequests, threshold: 1, unit: 'pending requests' }
      : candidate.signal.p95UtilizationPercent !== undefined
        ? { value: candidate.signal.p95UtilizationPercent, threshold: 80, unit: '% utilization' }
        : { value: candidate.signal.timeoutIncrease ?? 0, threshold: 1, unit: 'timeouts' };

    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_connection_pool',
      type: 'database_connection_pool',
      severity: candidate.signal.severity ?? 'warning',
      title: 'Database connection pool pressure in ' + candidate.serviceName,
      description: describeDatabaseConnectionPool(candidate),
      observedValue: observed.value,
      threshold: observed.threshold,
      unit: observed.unit,
      start,
      end,
      evidence: candidate.samples.map((sample) => ({
        kind: 'metric' as const,
        label: 'database-connection-pool',
        value: sample.pendingRequests ?? sample.usedConnections ?? sample.connectionTimeouts ?? 0,
        context: {
          service: sample.service,
          poolName: sample.poolName,
          timestamp: sample.timestamp,
          ...(sample.usedConnections !== undefined ? { usedConnections: sample.usedConnections } : {}),
          ...(sample.maxConnections !== undefined ? { maxConnections: sample.maxConnections } : {}),
          ...(sample.pendingRequests !== undefined ? { pendingRequests: sample.pendingRequests } : {}),
          ...(sample.connectionTimeouts !== undefined ? { connectionTimeouts: sample.connectionTimeouts } : {}),
          ...(candidate.signal.p95UtilizationPercent !== undefined ? { p95UtilizationPercent: candidate.signal.p95UtilizationPercent } : {}),
          ...(candidate.signal.p95PendingRequests !== undefined ? { p95PendingRequests: candidate.signal.p95PendingRequests } : {}),
          ...(candidate.signal.timeoutIncrease !== undefined ? { timeoutIncrease: candidate.signal.timeoutIncrease } : {}),
        },
      })),
    }));
  }

  const enabledWaitMetrics =
    detectorEnabled('database_connection_wait') ||
    detectorEnabled('database_dependency_degradation');
  const noWaitMetrics: Awaited<ReturnType<typeof searchDatabaseConnectionWaitMetrics>> = [];
  const [databaseConnectionWaitMetrics, baselineDatabaseConnectionWaitMetrics] = enabledWaitMetrics
    ? await Promise.all([
      cachedDatabaseConnectionWaitMetrics(deps, orgId, projectId, startTimestamp, endTimestamp),
      cachedDatabaseConnectionWaitMetrics(deps, 
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ])
    : [noWaitMetrics, noWaitMetrics];

  for (const candidate of detectorEnabled('database_connection_wait') ? detectDatabaseConnectionWait(
    databaseConnectionWaitMetrics,
    baselineDatabaseConnectionWaitMetrics,
  ) : []) {

    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_connection_wait',
      type: 'database_connection_wait',
      severity: candidate.signal.severity ?? 'warning',
      title: 'Database connection wait in ' + candidate.serviceName,
      description: describeDatabaseConnectionWait(candidate),
      observedValue: candidate.signal.p95WaitMs,
      threshold: 50,
      unit: 'ms',
      start,
      end,
      evidence: candidate.samples.map((sample) => ({
        kind: 'metric' as const,
        label: 'database-connection-wait',
        value: sample.waitTimeMs,
        context: {
          service: sample.service,
          poolName: sample.poolName,
          timestamp: sample.timestamp,
          waitTimeMs: sample.waitTimeMs,
          p50WaitMs: candidate.signal.p50WaitMs,
          p95WaitMs: candidate.signal.p95WaitMs,
          p99WaitMs: candidate.signal.p99WaitMs,
          ...(candidate.signal.baselineP95WaitMs !== undefined ? { baselineP95WaitMs: candidate.signal.baselineP95WaitMs } : {}),
          ...(candidate.signal.p95ChangePercent !== undefined ? { p95ChangePercent: candidate.signal.p95ChangePercent } : {}),
          regressionDetected: candidate.signal.regressionDetected,
        },
      })),
    }));
  }

  const databaseBatchTraces: DatabaseBatchTrace[] = currentDatabaseSpans.map((sample) => ({
    timestamp: sample.timestamp,
    service: sample.service,
    traceId: sample.traceId,
    spanId: sample.spanId,
    duration: sample.duration,
    ...(traceDurations.get(sample.traceId) !== undefined ? { traceDuration: traceDurations.get(sample.traceId) } : {}),
    dependencyType: sample.dependencyType,
    dependencyName: sample.dependencyName,
    ...(sample.dbBatchSize !== undefined ? { batchSize: sample.dbBatchSize } : {}),
    ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
    ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
    ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
    ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
    ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
    ...(sample.httpRoute ? { endpoint: sample.httpRoute } : {}),
  }));

  const baselineBatchTraces: DatabaseBatchTrace[] = baselineDatabaseSpans.map((sample) => ({
    timestamp: sample.timestamp,
    service: sample.service,
    traceId: sample.traceId,
    spanId: sample.spanId,
    duration: sample.duration,
    dependencyType: sample.dependencyType,
    dependencyName: sample.dependencyName,
    ...(sample.dbBatchSize !== undefined ? { batchSize: sample.dbBatchSize } : {}),
    ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
    ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
    ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
    ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
    ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
    ...(sample.httpRoute ? { endpoint: sample.httpRoute } : {}),
  }));

  for (const candidate of detectorEnabled('database_batch') ? detectDatabaseBatches(databaseBatchTraces, baselineBatchTraces) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_batch',
      type: 'database_batch',
      severity: candidate.signal.regressionDetected && ((candidate.signal.p95DurationChangePercent ?? 0) >= 100 || (candidate.signal.p99DurationChangePercent ?? 0) >= 100)
        ? 'critical'
        : 'warning',
      title: candidate.signal.regressionDetected
        ? 'Database batch regression in ' + candidate.serviceName
        : 'Database batch latency contribution in ' + candidate.serviceName,
      description: describeDatabaseBatch(candidate),
      observedValue: candidate.signal.regressionDetected
        ? candidate.signal.p95DurationChangePercent ?? candidate.signal.p99DurationChangePercent ?? 0
        : candidate.signal.p95TraceContributionPercent ?? 0,
      threshold: 50,
      unit: candidate.signal.regressionDetected ? '% duration regression' : '% of trace duration',
      start,
      end,
      evidence: candidate.samples.map((sample) => ({
        kind: 'trace' as const,
        label: 'database-batch-operation',
        value: sample.duration,
        context: {
          service: sample.service,
          traceId: sample.traceId,
          spanId: sample.spanId,
          timestamp: sample.timestamp,
          ...(sample.batchSize !== undefined ? { batchSize: sample.batchSize } : {}),
          logicalOperationCount: candidate.signal.logicalOperationCount,
          averageBatchSize: candidate.signal.averageBatchSize,
          p50BatchSize: candidate.signal.p50BatchSize,
          p95BatchSize: candidate.signal.p95BatchSize,
          p99BatchSize: candidate.signal.p99BatchSize,
          p50Duration: candidate.signal.p50Duration,
          p95Duration: candidate.signal.p95Duration,
          p99Duration: candidate.signal.p99Duration,
          ...(candidate.signal.baselineSampleCount !== undefined ? { baselineSampleCount: candidate.signal.baselineSampleCount } : {}),
          ...(candidate.signal.p95BatchSizeChangePercent !== undefined ? { p95BatchSizeChangePercent: candidate.signal.p95BatchSizeChangePercent } : {}),
          ...(candidate.signal.p99BatchSizeChangePercent !== undefined ? { p99BatchSizeChangePercent: candidate.signal.p99BatchSizeChangePercent } : {}),
          ...(candidate.signal.p95DurationChangePercent !== undefined ? { p95DurationChangePercent: candidate.signal.p95DurationChangePercent } : {}),
          ...(candidate.signal.p99DurationChangePercent !== undefined ? { p99DurationChangePercent: candidate.signal.p99DurationChangePercent } : {}),
          ...(candidate.signal.p95TraceContributionPercent !== undefined ? { p95TraceContributionPercent: candidate.signal.p95TraceContributionPercent } : {}),
          fingerprint: candidate.identity.fingerprint,
          databaseSystem: candidate.databaseSystem ?? '',
          dependencyName: sample.dependencyName,
          ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
          ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
          ...(candidate.collectionName ? { collectionName: candidate.collectionName } : {}),
          ...(sample.dbQueryText ? { query: sample.dbQueryText } : {}),
        },
      })),
    }));
  }

  const databaseDependencyTraces: DatabaseDependencyTrace[] = currentDatabaseSpans.map((sample) => ({
    timestamp: sample.timestamp,
    service: sample.service,
    traceId: sample.traceId,
    spanId: sample.spanId,
    duration: sample.duration,
    dependencyType: sample.dependencyType,
    dependencyName: sample.dependencyName,
    ...(sample.statusCode !== undefined ? { statusCode: sample.statusCode } : {}),
    ...(sample.errorType ? { errorType: sample.errorType } : {}),
    ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
    ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
    ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
    ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
    ...(sample.dbBatchSize !== undefined ? { dbBatchSize: sample.dbBatchSize } : {}),
  }));

  for (const candidate of detectorEnabled('database_dependency_degradation') ? detectDatabaseDependencyDegradation(
    databaseDependencyTraces,
    baselineDatabaseSpans,
    databasePoolMetrics,
    databaseConnectionWaitMetrics,
  ) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_dependency_degradation',
      type: 'database_dependency_degradation',
      severity: candidate.signal.degradationSignals.length >= 3 ? 'critical' : 'warning',
      title: 'Database dependency degradation in ' + candidate.serviceName,
      description: candidate.dependencyName + ' shows correlated ' +
        candidate.signal.degradationSignals.join(', ') + ' degradation across ' +
        candidate.signal.sampleCount + ' database operations.',
      observedValue: candidate.signal.p95Duration,
      threshold: 500,
      unit: 'ms',
      start,
      end,
      evidence: [
        ...candidate.samples.map((sample) => ({
        kind: 'trace' as const,
        label: 'database-dependency-degradation',
        value: sample.duration,
        context: {
          service: sample.service,
          traceId: sample.traceId,
          spanId: sample.spanId,
          timestamp: sample.timestamp,
          dependencyName: sample.dependencyName,
          databaseSystem: candidate.databaseSystem ?? '',
          p50Duration: candidate.signal.p50Duration,
          p95Duration: candidate.signal.p95Duration,
          p99Duration: candidate.signal.p99Duration,
          errorCount: candidate.signal.errorCount,
          errorRate: candidate.signal.errorRate,
          ...(candidate.signal.p95DurationChangePercent !== undefined ? { p95DurationChangePercent: candidate.signal.p95DurationChangePercent } : {}),
          poolPressure: candidate.signal.poolPressure,
          connectionWaitPressure: candidate.signal.connectionWaitPressure,
          batchOperationCount: candidate.signal.batchOperationCount,
          batchRate: candidate.signal.batchRate,
          ...(candidate.signal.averageBatchSize !== undefined ? { averageBatchSize: candidate.signal.averageBatchSize } : {}),
          queryFingerprintCount: candidate.signal.queryFingerprintCount,
          degradationSignals: candidate.signal.degradationSignals.join(','),
          confidence: candidate.signal.confidence,
        },
        })),
        {
          kind: 'recommendation',
          label: 'database-dependency-guidance',
        value: candidate.recommendation,
        context: {
          dependencyName: candidate.dependencyName,
          databaseSystem: candidate.databaseSystem ?? '',
        },
        },
      ],
    }));
  }

  const databaseTimeoutTraces: DatabaseTimeoutTrace[] = currentDatabaseSpans.map((sample) => ({
    timestamp: sample.timestamp,
    service: sample.service,
    traceId: sample.traceId,
    spanId: sample.spanId,
    duration: sample.duration,
    dependencyType: sample.dependencyType,
    dependencyName: sample.dependencyName,
    ...(sample.errorType ? { errorType: sample.errorType } : {}),
    ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
    ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
    ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
    ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
  }));

  for (const candidate of detectorEnabled('database_timeout') ? detectDatabaseTimeouts(databaseTimeoutTraces) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_timeout',
      type: 'database_timeout',
      severity: candidate.signal.timeoutRate >= 0.5 ? 'critical' : 'warning',
      title: 'Database timeouts detected in ' + candidate.serviceName,
      description: describeDatabaseTimeout(candidate),
      observedValue: candidate.signal.timeoutRate * 100,
      threshold: 10,
      unit: '% timeout rate',
      start,
      end,
      evidence: candidate.samples.map((sample) => ({
        kind: 'trace' as const,
        label: 'database-timeout',
        value: sample.duration,
        context: {
          service: sample.service,
          traceId: sample.traceId,
          spanId: sample.spanId,
          timestamp: sample.timestamp,
          errorType: sample.errorType ?? 'timeout',
          fingerprint: candidate.identity.fingerprint,
          databaseSystem: candidate.databaseSystem ?? '',
          dependencyName: sample.dependencyName,
          ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
          ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
          ...(sample.dbQueryText ? { query: sample.dbQueryText } : {}),
        },
      })),
    }));
  }

  const enabledResultSet = detectorEnabled('database_result_set');
  const [currentEndpointByTrace, baselineEndpointByTrace] = enabledResultSet
    ? await Promise.all([
      cachedRequestEndpoints(deps, orgId, projectId, startTimestamp, endTimestamp),
      cachedRequestEndpoints(deps, 
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ])
    : [new Map<string, string>(), new Map<string, string>()];

  const currentResultSetSpans = currentDatabaseSpans.map((sample) => ({
    ...sample,
    ...(currentEndpointByTrace.get(sample.traceId) ? { httpRoute: currentEndpointByTrace.get(sample.traceId) } : {}),
  }));

  const baselineResultSetSpans = baselineDatabaseSpans.map((sample) => ({
    ...sample,
    ...(baselineEndpointByTrace.get(sample.traceId) ? { httpRoute: baselineEndpointByTrace.get(sample.traceId) } : {}),
  }));

  const resultSetTraces: DatabaseResultSetTrace[] = currentResultSetSpans.map((sample) => ({
    timestamp: sample.timestamp,
    service: sample.service,
    traceId: sample.traceId,
    spanId: sample.spanId,
    duration: sample.duration,
    dependencyType: sample.dependencyType,
    dependencyName: sample.dependencyName,
    ...(traceDurations.get(sample.traceId) !== undefined ? { traceDuration: traceDurations.get(sample.traceId) } : {}),
    ...(sample.dbReturnedRows !== undefined ? { returnedRows: sample.dbReturnedRows } : {}),
    ...(sample.dbResponseBytes !== undefined ? { responseBytes: sample.dbResponseBytes } : {}),
    ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
    ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
    ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
    ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
    ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
    ...(sample.httpRoute ? { endpoint: sample.httpRoute } : {}),
    ...(sample.endpoint ? { endpoint: sample.endpoint } : {}),
  }));
  
  const baselineResultSetTraces: DatabaseResultSetTrace[] = baselineResultSetSpans.map((sample) => ({
    timestamp: sample.timestamp,
    service: sample.service,
    traceId: sample.traceId,
    spanId: sample.spanId,
    duration: sample.duration,
    dependencyType: sample.dependencyType,
    dependencyName: sample.dependencyName,
    ...(sample.dbReturnedRows !== undefined ? { returnedRows: sample.dbReturnedRows } : {}),
    ...(sample.dbResponseBytes !== undefined ? { responseBytes: sample.dbResponseBytes } : {}),
    ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
    ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
    ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
    ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
    ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
    ...(sample.httpRoute ? { endpoint: sample.httpRoute } : {}),
    ...(sample.endpoint ? { endpoint: sample.endpoint } : {}),
  }));

  for (const candidate of enabledResultSet ? detectDatabaseResultSets(resultSetTraces, baselineResultSetTraces).candidates : []) {
    const severity =
      candidate.signal.p99ReturnedRows >= 5000 ||
      candidate.signal.p95TraceContributionPercent !== undefined && candidate.signal.p95TraceContributionPercent >= 75 ||
      candidate.signal.p95RowsChangePercent !== undefined && candidate.signal.p95RowsChangePercent >= 200
        ? 'critical'
        : 'warning';

    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_result_set',
      type: 'database_result_set',
      severity,
      title: 'Large database result set in ' + candidate.serviceName,
      description: describeDatabaseResultSet(candidate),
      observedValue: candidate.signal.p95ReturnedRows,
      threshold: candidate.signal.largeResultRows,
      unit: 'returned rows',
      start,
      end,
      evidence: [
        ...candidate.samples.slice(0, 10).map((sample) => ({
          kind: 'trace' as const,
          label: 'database-result-set',
          value: sample.returnedRows ?? 0,
          context: {
            service: sample.service,
            traceId: sample.traceId,
            spanId: sample.spanId,
            timestamp: sample.timestamp,
            fingerprint: candidate.identity.fingerprint,
            fingerprintVersion: candidate.identity.fingerprintVersion,
            databaseSystem: candidate.databaseSystem ?? '',
            dependencyName: sample.dependencyName,
            returnedRows: sample.returnedRows ?? 0,
            durationMs: sample.duration,
            ...(sample.endpoint ? { endpoint: sample.endpoint } : {}),
            ...(sample.responseBytes !== undefined ? { responseBytes: sample.responseBytes } : {}),
            ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
            ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
            ...(candidate.collectionName ? { collectionName: candidate.collectionName } : {}),
            ...(sample.dbQueryText ? { query: sample.dbQueryText } : {}),
          },
        })),
        {
          kind: 'metric' as const,
          label: 'database-result-set-profile',
          value: candidate.signal.p95ReturnedRows,
          context: {
            sampleCount: candidate.signal.sampleCount,
            p50ReturnedRows: candidate.signal.p50ReturnedRows,
            p95ReturnedRows: candidate.signal.p95ReturnedRows,
            p99ReturnedRows: candidate.signal.p99ReturnedRows,
            p50Duration: candidate.signal.p50Duration,
            p95Duration: candidate.signal.p95Duration,
            p99Duration: candidate.signal.p99Duration,
            largeResultRate: candidate.signal.largeResultRate,
            ...(candidate.signal.baselineSampleCount !== undefined ? { baselineSampleCount: candidate.signal.baselineSampleCount } : {}),
            ...(candidate.signal.p95RowsChangePercent !== undefined ? { p95RowsChangePercent: candidate.signal.p95RowsChangePercent } : {}),
            ...(candidate.signal.p99RowsChangePercent !== undefined ? { p99RowsChangePercent: candidate.signal.p99RowsChangePercent } : {}),
            ...(candidate.signal.p95DurationChangePercent !== undefined ? { p95DurationChangePercent: candidate.signal.p95DurationChangePercent } : {}),
            ...(candidate.signal.p99DurationChangePercent !== undefined ? { p99DurationChangePercent: candidate.signal.p99DurationChangePercent } : {}),
            ...(candidate.signal.p95TraceContributionPercent !== undefined ? { p95TraceContributionPercent: candidate.signal.p95TraceContributionPercent } : {}),
            ...(candidate.signal.p99TraceContributionPercent !== undefined ? { p99TraceContributionPercent: candidate.signal.p99TraceContributionPercent } : {}),
            regressionDetected: candidate.signal.regressionDetected,
            confidence: candidate.signal.confidence,
            evidenceReasons: candidate.signal.evidenceReasons.join(';'),
            ...(candidate.endpoint ? { endpoint: candidate.endpoint } : {}),
            ...(candidate.payloadBytes ? {
              payloadP50Bytes: candidate.payloadBytes.p50,
              payloadP95Bytes: candidate.payloadBytes.p95,
              payloadP99Bytes: candidate.payloadBytes.p99,
            } : {}),
          },
        },
        {
          kind: 'recommendation' as const,
          label: 'database-result-set-guidance',
          value: candidate.recommendation.guidance,
          context: {
            action: candidate.recommendation.action,
            validation: candidate.recommendation.validation,
            ...(candidate.endpoint ? { endpoint: candidate.endpoint } : {}),
            fingerprint: candidate.identity.fingerprint,
          },
        },
      ],
    }));
  }

  const databaseErrorTraces = (spans: DatabaseQueryTrace[]): DatabaseErrorTrace[] =>
    spans.map((sample) => ({
      timestamp: sample.timestamp,
      service: sample.service,
      traceId: sample.traceId,
      spanId: sample.spanId,
      duration: sample.duration,
      dependencyType: sample.dependencyType,
      dependencyName: sample.dependencyName,
      ...(sample.statusCode !== undefined ? { statusCode: sample.statusCode } : {}),
      ...(sample.statusMessage ? { statusMessage: sample.statusMessage } : {}),
      ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
      ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
      ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
      ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
      ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
    }));

  for (const candidate of detectorEnabled('database_error') ? detectDatabaseErrors(databaseErrorTraces(currentDatabaseSpans)) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_error',
      type: 'database_error',
      severity: candidate.signal.errorRate >= 0.5 ? 'critical' : 'warning',
      title: 'Database errors increased in ' + candidate.serviceName,
      description: describeDatabaseError(candidate),
      observedValue: candidate.signal.errorRate * 100,
      threshold: 10,
      unit: '% error rate',
      start,
      end,
      evidence: [
        ...candidate.samples.map((sample) => ({
          kind: 'trace' as const,
          label: 'database-error-sample',
          value: sample.duration,
          context: {
            service: sample.service,
            traceId: sample.traceId,
            spanId: sample.spanId,
            statusCode: sample.statusCode ?? 0,
            statusMessage: sample.statusMessage ?? '',
            fingerprint: candidate.identity.fingerprint,
            databaseSystem: candidate.databaseSystem ?? '',
            dependencyName: sample.dependencyName,
            ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
            ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
            ...(sample.dbQueryText ? { query: sample.dbQueryText } : {}),
          },
        })),
        {
          kind: 'recommendation' as const,
          label: 'database-error-guidance',
          value: 'Inspect the database error pattern, query parameters, schema changes, locks, constraints, and recent deployments before changing the query or retry behavior.',
          context: {
            errorCount: candidate.signal.errorCount,
            totalCount: candidate.signal.totalCount,
            errorRate: candidate.signal.errorRate,
          },
        },
      ],
    }));
  }

  const queryVolumeTraces = (spans: DatabaseQueryTrace[]): DatabaseQueryVolumeTrace[] =>
    spans.map((sample) => ({
      timestamp: sample.timestamp,
      service: sample.service,
      traceId: sample.traceId,
      spanId: sample.spanId,
      duration: sample.duration,
      dependencyType: sample.dependencyType,
      dependencyName: sample.dependencyName,
      ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
      ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
      ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
      ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
      ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
      ...(sample.dbReturnedRows !== undefined ? { dbReturnedRows: sample.dbReturnedRows } : {}),
    }));

  for (const candidate of detectorEnabled('database_query_volume') ? detectDatabaseQueryVolume(
    queryVolumeTraces(currentDatabaseSpans),
    queryVolumeTraces(baselineDatabaseSpans),
  ) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_query_volume',
      type: 'database_query_volume',
      severity: candidate.signal.relativeIncrease >= 2 ? 'critical' : 'warning',
      title: 'Database query volume increased in ' + candidate.serviceName,
      description: describeDatabaseQueryVolume(candidate),
      observedValue: candidate.signal.currentCount,
      threshold: candidate.signal.baselineCount,
      unit: ' queries',
      start,
      end,
      evidence: [
        ...candidate.samples.map((sample) => ({
          kind: 'trace' as const,
          label: 'database-query-volume-sample',
          value: sample.duration,
          context: {
            service: sample.service,
            traceId: sample.traceId,
            spanId: sample.spanId,
            timestamp: sample.timestamp,
            fingerprint: candidate.identity.fingerprint,
            databaseSystem: candidate.databaseSystem ?? '',
            dependencyName: sample.dependencyName,
            currentCount: candidate.signal.currentCount,
            baselineCount: candidate.signal.baselineCount,
            absoluteIncrease: candidate.signal.absoluteIncrease,
            relativeIncrease: candidate.signal.relativeIncrease,
            ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
            ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
            ...(sample.dbQueryText ? { query: sample.dbQueryText } : {}),
          },
        })),
        {
          kind: 'recommendation' as const,
          label: 'query-volume-guidance',
          value: 'Check whether the increased query volume comes from repeated reads, pagination, fan-out, or a new access path. Compare the query count with request volume before changing the query or schema.',
          context: {
            currentCount: candidate.signal.currentCount,
            baselineCount: candidate.signal.baselineCount,
            relativeIncrease: candidate.signal.relativeIncrease,
          },
        },
      ],
    }));
  }

  const nPlusOneTraces: NPlusOneTrace[] = currentDatabaseSpans.flatMap((sample) => {
    if (!sample.parentSpanId) return [];

    return [{
      timestamp: sample.timestamp,
      service: sample.service,
      traceId: sample.traceId,
      spanId: sample.spanId,
      parentSpanId: sample.parentSpanId,
      duration: sample.duration,
      dependencyType: sample.dependencyType,
      dependencyName: sample.dependencyName,
      ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
      ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
      ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
      ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
      ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
      ...(sample.dbBatchSize !== undefined ? { dbBatchSize: sample.dbBatchSize } : {}),
    }];
  });

  for (const candidate of detectorEnabled('database_n_plus_one') ? detectNPlusOne(nPlusOneTraces) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'database_n_plus_one',
      type: 'database_n_plus_one',
      severity: 'warning',
      title: 'Repeated database query detected in ' + candidate.serviceName,
      description: describeNPlusOne(candidate),
      observedValue: candidate.signal.occurrences,
      threshold: 3,
      unit: ' occurrences',
      start,
      end,
      evidence: [
        ...candidate.samples.map((sample) => ({
          kind: 'trace' as const,
          label: 'n-plus-one-query',
          value: sample.duration,
          context: {
            service: sample.service,
            traceId: sample.traceId,
            spanId: sample.spanId,
            parentSpanId: sample.parentSpanId,
            timestamp: sample.timestamp,
            fingerprint: candidate.identity.fingerprint,
            databaseSystem: candidate.databaseSystem ?? '',
            dependencyName: sample.dependencyName,
            ...(candidate.queryOperation ? { queryOperation: candidate.queryOperation } : {}),
            ...(candidate.querySummary ? { querySummary: candidate.querySummary } : {}),
            ...(sample.dbQueryText ? { query: sample.dbQueryText } : {}),
          },
        })),
        {
          kind: 'recommendation' as const,
          label: 'n-plus-one-guidance',
          value: 'Check whether the repeated query can be loaded with the parent records in one query or replaced with a batched operation. Confirm the query plan before changing the access pattern.',
          context: {
            occurrences: candidate.signal.occurrences,
            totalDurationMs: candidate.signal.totalDurationMs,
            traceId: candidate.traceId,
            parentSpanId: candidate.parentSpanId,
          },
        },
      ],
    }));
  }

  return currentDatabaseSpans;
}

async function cachedRequestEndpoints(
  deps: DatabaseSignalDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Map<string, string>> {
  const entries = await deps.cachedQuery('request-endpoints', orgId, projectId, startTimestamp, endTimestamp, async () =>
    Array.from(await searchRequestEndpoints(deps.quickwit, orgId, projectId, startTimestamp, endTimestamp)),
  );
  return new Map(entries);
}

async function cachedDatabaseQuerySpans(
  deps: DatabaseSignalDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DatabaseQueryTrace[]> {
  return deps.cachedQuery('database-query-spans', orgId, projectId, startTimestamp, endTimestamp, () =>
    searchDatabaseQuerySpans(deps.quickwit, orgId, projectId, startTimestamp, endTimestamp),
  );
}

async function cachedDatabaseConnectionPoolMetrics(
  deps: DatabaseSignalDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DatabaseConnectionPoolSample[]> {
  return deps.cachedQuery('database-connection-pool', orgId, projectId, startTimestamp, endTimestamp, () =>
    searchDatabaseConnectionPoolMetrics(deps.quickwit, orgId, projectId, startTimestamp, endTimestamp),
  );
}

async function cachedDatabaseConnectionWaitMetrics(
  deps: DatabaseSignalDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Awaited<ReturnType<typeof searchDatabaseConnectionWaitMetrics>>> {
  return deps.cachedQuery('database-connection-wait', orgId, projectId, startTimestamp, endTimestamp, () =>
    searchDatabaseConnectionWaitMetrics(deps.quickwit, orgId, projectId, startTimestamp, endTimestamp),
  );
}

async function cachedTraceDurations(
  deps: DatabaseSignalDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Map<string, number>> {
  const entries = await deps.cachedQuery('trace-durations', orgId, projectId, startTimestamp, endTimestamp, async () => {
    const result = await deps.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(orgId, projectId),
      startTimestamp,
      endTimestamp,
      maxHits: 5000,
      sortBy: ['-duration'],
    });

    const traces = new Map<string, { start: number; end: number }>();

    for (const hit of result.hits ?? []) {
      const source = hit._source;
      if (!source?.traceId) continue;

      const start = new Date(String(source.timestamp ?? '')).getTime();
      const duration = Number(source.duration ?? 0);
      if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) continue;

      const end = start + duration;
      const existing = traces.get(source.traceId);
      if (!existing) {
        traces.set(source.traceId, { start, end });
        continue;
      }

      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
    }

    return Array.from(new Map(
      Array.from(traces.entries())
        .map(([traceId, value]) => [traceId, value.end - value.start] as const)
        .filter(([, duration]) => duration > 0),
    ));
  });
  return new Map(entries);
}
