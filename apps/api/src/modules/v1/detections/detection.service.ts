import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { db } from '../../../common/db';
import { findings, type DetectionEvidence } from '../../../common/db/schema/findings';
import { quickwitTenantQuery, quickwitTerm } from '../../../common/quickwit/query';
import { ProjectsRepository } from '../projects/projects.repository';
import { createIssueFromDetection } from '../intelligence/detection-issue.adapter';
import { IssueLifecycleService } from '../intelligence/issue-lifecycle.service';
import { detectDatabaseQueries, type DatabaseQueryTrace } from '../intelligence/database-query.detector';
import { detectNPlusOne, type NPlusOneTrace } from '../intelligence/n-plus-one.detector';
import { detectDatabaseQueryVolume, type DatabaseQueryVolumeTrace } from '../intelligence/database-query-volume.detector';
import { detectDatabaseErrors, type DatabaseErrorTrace } from '../intelligence/database-error.detector';
import { detectDatabaseLatencyContribution, type DatabaseLatencyContributionTrace } from '../intelligence/database-latency-contribution.detector';
import { detectDatabaseConnectionPool, type DatabaseConnectionPoolSample } from '../intelligence/database-connection-pool.detector';
import { detectDatabaseTimeouts, type DatabaseTimeoutTrace } from '../intelligence/database-timeout.detector';
import { detectDatabaseResultSets, type DatabaseResultSetTrace } from '../intelligence/database-result-set.detector';
import { detectDatabaseConnectionWait, type DatabaseConnectionWaitSample } from '../intelligence/database-connection-wait.detector';
import { detectDatabaseBatches, type DatabaseBatchTrace } from '../intelligence/database-batch.detector';
import { detectDatabaseDependencyDegradation, type DatabaseDependencyTrace } from '../intelligence/database-dependency-degradation.detector';
import { sanitizeRequestUrl } from './detection.utils';
import { correlateFindings } from './detection.correlation';
import { completeDetectionRun, failDetectionRun, startDetectionRun } from './detection.run';
import { evaluateSignal, evaluateThroughput, evaluateTraceSpan } from './detection.engine';
import { evaluateServicePerformance } from '../intelligence/service-performance.engine';
import type { DetectionFinding, DetectionWindow, FindingSeverity, FindingType } from './detection.types';

const WINDOW_MS = 15 * 60_000;

interface ServiceBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
}

interface DependencyBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  dependencyType?: { buckets?: Array<{ key: string; doc_count: number }> };
}

interface DependencyServiceBucket {
  key: string;
  dependencies?: { buckets?: DependencyBucket[] };
}

interface Aggregations {
  services?: { buckets?: ServiceBucket[] };
  dependencies?: { buckets?: DependencyServiceBucket[] };
}

interface RequestSource {
  timestamp?: string;
  service?: string;
  method?: string;
  url?: string;
  duration?: number;
  statusCode?: number;
  traceId?: string;
}

interface MetricSource {
  timestamp?: string;
  service?: string;
  name?: string;
  value?: number;
  connectionPoolName?: string;
  connectionPoolState?: string;
  attributes?: Record<string, unknown>;
}

interface TraceSource {
  timestamp?: string;
  service?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  duration?: number;
  statusCode?: number;
  statusMessage?: string;
  errorType?: string;
  dependencyName?: string;
  dependencyType?: string;
  spanKind?: number;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  dbReturnedRows?: number;
  dbBatchSize?: number;
  dbResponseBytes?: number;
  httpRoute?: string;
  endpoint?: string;
}

@Injectable()
export class DetectionService {
  constructor(
    private readonly quickwit: QuickwitService,
    private readonly projectsRepository: ProjectsRepository,
    private readonly issueLifecycleService: IssueLifecycleService,
  ) {}

  async run(orgId: string, projectId: string): Promise<DetectionFinding[]> {
    await this.assertProjectAccess(orgId, projectId);
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_MS);
    const run = await startDetectionRun(orgId, projectId, start, end);

    try {
      const findings = await this.executeDetection(orgId, projectId, start, end);
      await completeDetectionRun(run.id, findings.length);
      return findings;
    } catch (error) {
      await failDetectionRun(run.id, error instanceof Error ? error.message : 'Detection failed');
      throw error;
    }
  }

  private async executeDetection(orgId: string, projectId: string, start: Date, end: Date): Promise<DetectionFinding[]> {
    await this.assertProjectAccess(orgId, projectId);

    const startTimestamp = Math.floor(start.getTime() / 1000);
    const endTimestamp = Math.floor(end.getTime() / 1000);

    const [currentBuckets, baselineBuckets] = await Promise.all([
      this.searchServiceBuckets(orgId, projectId, startTimestamp, endTimestamp),
      this.searchServiceBuckets(
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);
    const baselineByService = new Map(
      baselineBuckets.map((bucket) => [
        bucket.key,
        {
          p50: this.getPercentile(bucket, '50.0'),
          p95: this.getPercentile(bucket, '95.0'),
          p99: this.getPercentile(bucket, '99.0'),
          latency: this.getLatency(bucket),
          errorRate: this.getErrorRate(bucket),
          requests: bucket.doc_count,
          samples: bucket.doc_count,
        },
      ]),
    );
    const detected: DetectionFinding[] = [];

    for (const bucket of currentBuckets) {
      const p50 = this.getPercentile(bucket, '50.0');
      const p95 = this.getPercentile(bucket, '95.0');
      const p99 = this.getPercentile(bucket, '99.0');
      const errorRate = this.getErrorRate(bucket);
      const baseline = baselineByService.get(bucket.key);

      const performanceSignal = evaluateServicePerformance(
        {
          serviceName: bucket.key,
          endpoint: 'service:' + bucket.key,
          sampleCount: bucket.doc_count,
          p50,
          p95,
          p99,
          errorRate: errorRate / 100,
          throughputPerMinute: bucket.doc_count / 15,
        },
        baseline
          ? {
              p50: baseline.p50,
              p95: baseline.p95,
              p99: baseline.p99,
              errorRate: baseline.errorRate / 100,
              throughputPerMinute: baseline.requests / 15,
            }
          : undefined,
      );

      if (performanceSignal) {
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName: bucket.key,
          type: 'performance',
          severity: performanceSignal.severity,
          title: 'Service performance degradation in ' + bucket.key,
          description: this.describePerformanceSignal(performanceSignal),
          observedValue: p95,
          threshold: 500,
          unit: 'ms',
          start,
          end,
          evidence: [
            {
              kind: 'metric',
              label: 'performance-profile',
              value: p95,
              context: {
                service: bucket.key,
                p50,
                p95,
                p99,
                errorRate,
                throughputPerMinute: bucket.doc_count / 15,
                sampleCount: bucket.doc_count,
                reasons: performanceSignal.reasons.join('; '),
                ...(performanceSignal.latency.p95ChangePercent !== undefined
                  ? { p95ChangePercent: performanceSignal.latency.p95ChangePercent }
                  : {}),
                ...(performanceSignal.latency.p99ChangePercent !== undefined
                  ? { p99ChangePercent: performanceSignal.latency.p99ChangePercent }
                  : {}),
              },
            },
            ...(await this.requestEvidence(
              orgId,
              projectId,
              bucket.key,
              startTimestamp,
              endTimestamp,
              'latency',
            )),
          ],
        }));
      }

      const throughputSignal = evaluateThroughput(
        bucket.doc_count,
        baseline
          ? { value: baseline.requests, samples: baseline.requests }
          : undefined,
      );

      if (throughputSignal) {
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName: bucket.key,
          type: throughputSignal.type,
          severity: throughputSignal.severity,
          title: 'Throughput degradation detected in ' + bucket.key,
          description: this.describeThroughputSignal(throughputSignal),
          observedValue: throughputSignal.observedValue,
          threshold: throughputSignal.threshold,
          unit: throughputSignal.unit,
          start,
          end,
          evidence: [
            {
              kind: 'metric',
              label: 'throughput-regression',
              value: throughputSignal.observedValue,
              context: {
                service: bucket.key,
                baselineRequests: throughputSignal.baselineValue,
                changePercent: throughputSignal.changePercent,
                p50,
                p95,
                p99,
              },
            },
          ],
        }));
      }
    }

    const [currentDependencies, baselineDependencies] = await Promise.all([
      this.searchDependencyBuckets(orgId, projectId, startTimestamp, endTimestamp),
      this.searchDependencyBuckets(
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);

    const baselineByDependency = new Map(
      baselineDependencies.map((dependency) => [
        dependency.key,
        dependency,
      ]),
    );

    for (const dependency of currentDependencies) {
      const baseline = baselineByDependency.get(dependency.key);
      const signal = evaluateSignal(
        'dependency_latency',
        dependency.latency,
        baseline
          ? { value: baseline.latency, samples: baseline.samples }
          : undefined,
      );

      if (!signal) continue;

      const [serviceName, dependencyType, dependencyName] = dependency.key.split('|');
      if (!serviceName || !dependencyType || !dependencyName) continue;

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName,
        type: signal.type,
        severity: signal.severity,
        title: 'Slow ' + dependencyType + ' dependency in ' + serviceName,
        description: this.describeSignal(
          dependencyType + ' dependency ' + dependencyName + ' has a 95th percentile latency of ' + Math.round(dependency.latency) + 'ms.',
          signal,
        ),
        observedValue: signal.observedValue,
        threshold: signal.threshold,
        unit: signal.unit,
        start,
        end,
        evidence: [
          ...(await this.dependencyEvidence(
            orgId,
            projectId,
            serviceName,
            dependencyType,
            dependencyName,
            startTimestamp,
            endTimestamp,
          )),
          {
            kind: 'recommendation',
            label: 'optimization-guidance',
            value: this.dependencyRecommendation(dependencyType),
            context: {
              dependencyType,
              dependencyName,
              observedLatencyMs: Math.round(dependency.latency),
            },
          },
        ],
      }));
    }

    const [currentDatabaseSpans, baselineDatabaseSpans] = await Promise.all([
      this.searchDatabaseQuerySpans(orgId, projectId, startTimestamp, endTimestamp),
      this.searchDatabaseQuerySpans(
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);

    for (const candidate of detectDatabaseQueries(currentDatabaseSpans, baselineDatabaseSpans)) {
      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_query',
        severity: candidate.signal.severity,
        title: 'Slow database query in ' + candidate.serviceName,
        description: this.describeDatabaseQuery(candidate),
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

    const traceDurations = await this.searchTraceDurations(
      orgId,
      projectId,
      startTimestamp,
      endTimestamp,
    );

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

    for (const candidate of detectDatabaseLatencyContribution(databaseLatencyContributionTraces)) {
      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_latency_contribution',
        severity: candidate.signal.p95ContributionPercent >= 75 ? 'critical' : 'warning',
        title: 'Database latency dominates traces in ' + candidate.serviceName,
        description: this.describeDatabaseLatencyContribution(candidate),
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

    const databasePoolMetrics = await this.searchDatabaseConnectionPoolMetrics(
      orgId,
      projectId,
      startTimestamp,
      endTimestamp,
    );

    for (const candidate of detectDatabaseConnectionPool(databasePoolMetrics)) {
      const observed = candidate.signal.p95PendingRequests !== undefined
        ? { value: candidate.signal.p95PendingRequests, threshold: 1, unit: 'pending requests' }
        : candidate.signal.p95UtilizationPercent !== undefined
          ? { value: candidate.signal.p95UtilizationPercent, threshold: 80, unit: '% utilization' }
          : { value: candidate.signal.timeoutIncrease ?? 0, threshold: 1, unit: 'timeouts' };

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_connection_pool',
        severity: candidate.signal.severity,
        title: 'Database connection pool pressure in ' + candidate.serviceName,
        description: this.describeDatabaseConnectionPool(candidate),
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

    const [databaseConnectionWaitMetrics, baselineDatabaseConnectionWaitMetrics] = await Promise.all([
      this.searchDatabaseConnectionWaitMetrics(orgId, projectId, startTimestamp, endTimestamp),
      this.searchDatabaseConnectionWaitMetrics(
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);

    for (const candidate of detectDatabaseConnectionWait(
      databaseConnectionWaitMetrics,
      baselineDatabaseConnectionWaitMetrics,
    )) {

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_connection_wait',
        severity: critical ? 'critical' : 'warning',
        title: 'Database connection wait in ' + candidate.serviceName,
        description: this.describeDatabaseConnectionWait(candidate),
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

    for (const candidate of detectDatabaseBatches(databaseBatchTraces, baselineBatchTraces)) {
      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_batch',
        severity: candidate.signal.regressionDetected && ((candidate.signal.p95DurationChangePercent ?? 0) >= 100 || (candidate.signal.p99DurationChangePercent ?? 0) >= 100)
          ? 'critical'
          : 'warning',
        title: candidate.signal.regressionDetected
          ? 'Database batch regression in ' + candidate.serviceName
          : 'Database batch latency contribution in ' + candidate.serviceName,
        description: this.describeDatabaseBatch(candidate),
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
            batchSize: sample.batchSize,
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
      ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
      ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
      ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
      ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
      ...(sample.dbBatchSize !== undefined ? { dbBatchSize: sample.dbBatchSize } : {}),
    }));

    for (const candidate of detectDatabaseDependencyDegradation(
      databaseDependencyTraces,
      baselineDatabaseSpans,
      databasePoolMetrics,
      databaseConnectionWaitMetrics,
    )) {
      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
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
        evidence: candidate.samples.map((sample) => ({
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

    for (const candidate of detectDatabaseTimeouts(databaseTimeoutTraces)) {
      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_timeout',
        severity: candidate.signal.timeoutRate >= 0.5 ? 'critical' : 'warning',
        title: 'Database timeouts detected in ' + candidate.serviceName,
        description: this.describeDatabaseTimeout(candidate),
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

    const [currentEndpointByTrace, baselineEndpointByTrace] = await Promise.all([
      this.searchRequestEndpoints(orgId, projectId, startTimestamp, endTimestamp),
      this.searchRequestEndpoints(
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);

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

    const resultSetDetection = detectDatabaseResultSets(resultSetTraces, baselineResultSetTraces);
    for (const candidate of resultSetDetection.candidates) {
      const severity =
        candidate.signal.p99ReturnedRows >= 5000 ||
        candidate.signal.p95TraceContributionPercent !== undefined && candidate.signal.p95TraceContributionPercent >= 75 ||
        candidate.signal.p95RowsChangePercent !== undefined && candidate.signal.p95RowsChangePercent >= 200
          ? 'critical'
          : 'warning';

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_result_set',
        severity,
        title: 'Large database result set in ' + candidate.serviceName,
        description: this.describeDatabaseResultSet(candidate),
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

    for (const candidate of detectDatabaseErrors(databaseErrorTraces(currentDatabaseSpans))) {
      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_error',
        severity: candidate.signal.errorRate >= 0.5 ? 'critical' : 'warning',
        title: 'Database errors increased in ' + candidate.serviceName,
        description: this.describeDatabaseError(candidate),
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

    for (const candidate of detectDatabaseQueryVolume(
      queryVolumeTraces(currentDatabaseSpans),
      queryVolumeTraces(baselineDatabaseSpans),
    )) {
      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_query_volume',
        severity: candidate.signal.relativeIncrease >= 2 ? 'critical' : 'warning',
        title: 'Database query volume increased in ' + candidate.serviceName,
        description: this.describeDatabaseQueryVolume(candidate),
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

    for (const candidate of detectNPlusOne(nPlusOneTraces)) {
      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: 'database_n_plus_one',
        severity: 'warning',
        title: 'Repeated database query detected in ' + candidate.serviceName,
        description: this.describeNPlusOne(candidate),
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

    const traceSpans = await this.searchTraceSpanCandidates(
      orgId,
      projectId,
      startTimestamp,
      endTimestamp,
    );

    for (const candidate of traceSpans) {
      const signal = evaluateTraceSpan(candidate.spanDuration, candidate.traceDuration);
      if (!signal) continue;

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: signal.type,
        severity: signal.severity,
        title: 'Span dominates trace latency in ' + candidate.serviceName,
        description:
          candidate.spanName +
          ' accounts for ' +
          signal.observedValue.toFixed(0) +
          '% of the trace duration.',
        observedValue: signal.observedValue,
        threshold: signal.threshold,
        unit: signal.unit,
        start,
        end,
        evidence: [
          {
            kind: 'trace',
            label: 'dominant-span',
            value: candidate.spanDuration,
            context: {
              traceId: candidate.traceId,
              spanId: candidate.spanId,
              spanName: candidate.spanName,
              traceDurationMs: candidate.traceDuration,
              contributionPercent: signal.observedValue,
            },
          },
        ],
      }));
    }

    const correlated = correlateFindings(detected);

    for (const bottleneck of correlated) {
      const dependencyDescription = bottleneck.dependencyName
        ? ' The correlated dependency is ' + bottleneck.dependencyName + '.'
        : '';
      const supportingTypes = bottleneck.supportingFindings
        .map((finding) => finding.type)
        .filter((type, index, types) => types.indexOf(type) === index)
        .join(', ');

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: bottleneck.serviceName,
        type: 'bottleneck',
        severity: bottleneck.supportingFindings.some((finding) => finding.severity === 'critical')
          ? 'critical'
          : bottleneck.latency.severity,
        title: 'Correlated bottleneck in ' + bottleneck.serviceName,
        description:
          'Request latency is correlated with ' +
          supportingTypes +
          '.' +
          dependencyDescription +
          ' The evidence points to the dependency or operation captured in the trace rather than the API boundary alone.',
        observedValue: bottleneck.latency.observedValue,
        threshold: bottleneck.latency.threshold,
        unit: bottleneck.latency.unit,
        start,
        end,
        evidence: [
          {
            kind: 'metric',
            label: 'correlated-signal',
            value: bottleneck.latency.observedValue,
            context: {
              service: bottleneck.serviceName,
              sourceFindingId: bottleneck.latency.id,
              sourceFindingType: bottleneck.latency.type,
            },
          },
          ...bottleneck.supportingFindings.map((finding) => ({
            kind: 'metric' as const,
            label: 'supporting-finding',
            value: finding.observedValue,
            context: {
              findingId: finding.id,
              findingType: finding.type,
              severity: finding.severity,
              service: finding.serviceName,
            },
          })),
          ...bottleneck.traceIds.map((traceId) => ({
            kind: 'trace' as const,
            label: 'correlated-trace',
            value: traceId,
            context: {
              traceId,
              service: bottleneck.serviceName,
            },
          })),
          {
            kind: 'recommendation',
            label: 'optimization-guidance',
            value: bottleneck.recommendation,
            context: {
              dependencyType: bottleneck.dependencyType ?? null,
              dependencyName: bottleneck.dependencyName ?? null,
              source: 'deterministic-correlation',
            },
          },
        ],
      }));
    }

    await this.persistIssueLifecycles(orgId, projectId, detected);
    return detected;
  }

  private async persistIssueLifecycles(orgId: string, projectId: string, findings: DetectionFinding[]): Promise<void> {
    for (const finding of findings) {
      await this.issueLifecycleService.apply({
        orgId,
        projectId,
        issue: createIssueFromDetection(finding),
      });
    }
  }

  async createFindingFromError(
    orgId: string,
    projectId: string,
    input: { fingerprint: string; service?: string },
  ): Promise<DetectionFinding> {
    await this.assertProjectAccess(orgId, projectId);

    const queryParts = [
      quickwitTenantQuery(orgId, projectId),
      quickwitTerm('fingerprint', input.fingerprint),
      input.service ? quickwitTerm('service', input.service) : '',
      'level:error',
    ].filter(Boolean);
    const result = await this.quickwit.search<RequestSource & { fingerprint?: string; message?: string; errorType?: string }>(
      QUICKWIT_INDEXES.logs,
      {
        query: queryParts.join(' AND '),
        startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
        endTimestamp: Math.floor(Date.now() / 1000),
        maxHits: 100,
        sortBy: ['-timestamp'],
      },
    );

    if (!result.hits.length) {
      throw new NotFoundException('Error group not found in telemetry');
    }

    const sources = result.hits
      .map((hit) => hit._source)
      .filter((source): source is RequestSource & { fingerprint?: string; message?: string; errorType?: string } => !!source);

    const firstTimestamp = sources
      .map((source) => new Date(String(source.timestamp ?? '')).getTime())
      .filter(Number.isFinite)
      .reduce((value, timestamp) => Math.min(value, timestamp), Date.now());

    const lastTimestamp = sources
      .map((source) => new Date(String(source.timestamp ?? '')).getTime())
      .filter(Number.isFinite)
      .reduce((value, timestamp) => Math.max(value, timestamp), Date.now());

    const serviceName = String(input.service ?? sources[0]?.service ?? 'unknown');
    const errorType = String(sources[0]?.errorType ?? 'Error');
    const message = String(sources[0]?.message ?? input.fingerprint);
    const traceIds = [...new Set(sources.map((source) => source.traceId).filter((id): id is string => !!id))].slice(0, 20);

    const existing = await db
      .select()
      .from(findings)
      .where(and(
        eq(findings.orgId, orgId),
        eq(findings.projectId, projectId),
        eq(findings.type, 'error_group'),
        eq(findings.serviceName, serviceName),
        eq(findings.title, 'Error group: ' + message),
      ))
      .limit(1);

    if (existing[0]) return this.toDetectionFinding(existing[0]);

    return this.persistFinding({
      orgId,
      projectId,
      serviceName,
      type: 'error_group',
      severity: 'warning',
      title: 'Error group: ' + message,
      description:
        errorType +
        ' occurred ' +
        sources.length +
        ' time' +
        (sources.length === 1 ? '' : 's') +
        ' in ' +
        serviceName +
        ' during the last 24 hours.',
      observedValue: sources.length,
      threshold: 0,
      unit: ' occurrences',
      start: new Date(firstTimestamp),
      end: new Date(lastTimestamp),
      evidence: [
        {
          kind: 'log',
          label: 'error-group',
          value: message,
          context: {
            fingerprint: input.fingerprint,
            errorType,
            occurrences: sources.length,
            service: serviceName,
          },
        },
        ...traceIds.map((traceId) => ({
          kind: 'trace' as const,
          label: 'error-trace',
          value: traceId,
          context: { traceId, service: serviceName },
        })),
      ],
    });
  }

  async list(orgId: string, projectId: string, limit = 50) {
    await this.assertProjectAccess(orgId, projectId);

    return db
      .select()
      .from(findings)
      .where(and(eq(findings.orgId, orgId), eq(findings.projectId, projectId)))
      .orderBy(desc(findings.detectedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  private async searchServiceBuckets(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<ServiceBucket[]> {
    const result = await this.quickwit.search<never>(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(orgId, projectId),
      startTimestamp,
      endTimestamp,
      maxHits: 0,
      aggregations: {
        services: {
          terms: {
            field: 'service',
            size: 100,
            order: { _count: 'desc' },
          },
          aggs: {
            latency: {
              percentiles: { field: 'duration', percents: [50, 95, 99] },
            },
            errors: {
              filter: { query: 'statusCode:[500 TO 599]' },
            },
          },
        },
      },
    });

    return (result.aggregations as Aggregations | undefined)?.services?.buckets ?? [];
  }

  private getPercentile(bucket: ServiceBucket, percentile: string): number {
    const value = bucket.latency?.values?.[percentile] ?? 0;
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  private getLatency(bucket: ServiceBucket): number {
    return this.getPercentile(bucket, '95.0');
  }

  private getErrorRate(bucket: ServiceBucket): number {
    const errors = bucket.errors?.doc_count ?? 0;
    return bucket.doc_count ? (errors / bucket.doc_count) * 100 : 0;
  }

  private async searchDependencyBuckets(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<Array<{ key: string; latency: number; samples: number }>> {
    const result = await this.quickwit.search<never>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(
        orgId,
        projectId,
        quickwitTerm('spanKind', '3'),
      ),
      startTimestamp,
      endTimestamp,
      maxHits: 0,
      aggregations: {
        dependencies: {
          terms: {
            field: 'service',
            size: 100,
            order: { _count: 'desc' },
          },
          aggs: {
            dependencies: {
              terms: {
                field: 'dependencyName',
                size: 100,
                order: { _count: 'desc' },
              },
              aggs: {
                latency: {
                  percentiles: { field: 'duration', percents: [95] },
                },
                dependencyType: {
                  terms: {
                    field: 'dependencyType',
                    size: 1,
                  },
                },
              },
            },
          },
        },
      },
    });

    const aggregation = (result.aggregations as Aggregations | undefined)?.dependencies;
    return (aggregation?.buckets ?? []).flatMap((serviceBucket) =>
      (serviceBucket.dependencies?.buckets ?? []).flatMap((dependencyBucket) => {
        const dependencyName = dependencyBucket.key;
        if (!dependencyName) return [];

        const dependencyType = dependencyBucket.dependencyType?.buckets?.[0]?.key;
        const latency = dependencyBucket.latency?.values?.['95.0'] ?? 0;
        if (!dependencyType || latency <= 0) return [];

        return [{
          key: serviceBucket.key + '|' + dependencyType + '|' + dependencyName,
          latency,
          samples: dependencyBucket.doc_count,
        }];
      }),
    );
  }

  private async searchDatabaseConnectionPoolMetrics(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<DatabaseConnectionPoolSample[]> {
    const names = [
      'db.client.connection.count',
      'db.client.connection.max',
      'db.client.connection.pending_requests',
      'db.client.connection.timeouts',
    ].map((name) => quickwitTerm('name', name)).join(' OR ');

    const result = await this.quickwit.search<MetricSource>(QUICKWIT_INDEXES.metrics, {
      query: quickwitTenantQuery(orgId, projectId, names),
      startTimestamp,
      endTimestamp,
      maxHits: 5000,
      sortBy: ['timestamp'],
    });

    const snapshots = new Map<string, DatabaseConnectionPoolSample>();
    for (const hit of result.hits ?? []) {
      const source = hit._source;
      const timestamp = source?.timestamp;
      const service = source?.service;
      const poolName = source?.connectionPoolName ?? this.metricString(source?.attributes?.['db.client.connection.pool.name']);
      const name = source?.name;
      const value = Number(source?.value);
      if (!timestamp || !service || !poolName || !name || !Number.isFinite(value)) continue;

      const key = service + '\\0' + poolName + '\\0' + timestamp;
      const snapshot = snapshots.get(key) ?? { timestamp, service, poolName };
      const state = source?.connectionPoolState ?? this.metricString(source?.attributes?.['db.client.connection.state']);

      if (name === 'db.client.connection.count') {
        if (state === 'used') snapshot.usedConnections = value;
      } else if (name === 'db.client.connection.max') {
        snapshot.maxConnections = value;
      } else if (name === 'db.client.connection.pending_requests') {
        snapshot.pendingRequests = value;
      } else if (name === 'db.client.connection.timeouts') {
        snapshot.connectionTimeouts = value;
      }
      snapshots.set(key, snapshot);
    }

    return Array.from(snapshots.values());
  }

  private metricString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private describeDatabaseConnectionPool(
    candidate: ReturnType<typeof detectDatabaseConnectionPool>[number],
  ): string {
    const reasons = [
      candidate.signal.p95UtilizationPercent !== undefined
        ? 'p95 utilization is ' + candidate.signal.p95UtilizationPercent.toFixed(0) + '%'
        : '',
      candidate.signal.p95PendingRequests !== undefined
        ? 'p95 pending requests are ' + candidate.signal.p95PendingRequests.toFixed(0)
        : '',
      candidate.signal.timeoutIncrease !== undefined && candidate.signal.timeoutIncrease > 0
        ? candidate.signal.timeoutIncrease.toFixed(0) + ' connection timeouts occurred'
        : '',
    ].filter(Boolean);
    return candidate.poolName + ' shows database connection pool pressure: ' + reasons.join(', ') + '.';
  }

  private async searchDatabaseConnectionWaitMetrics(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<DatabaseConnectionWaitSample[]> {
    const query = quickwitTerm('name', 'db.client.connection.wait_time');
    const result = await this.quickwit.search<MetricSource>(QUICKWIT_INDEXES.metrics, {
      query: quickwitTenantQuery(orgId, projectId, query),
      startTimestamp,
      endTimestamp,
      maxHits: 5000,
      sortBy: ['timestamp'],
    });

    return (result.hits ?? []).flatMap((hit) => {
      const source = hit._source;
      const timestamp = source?.timestamp;
      const service = source?.service;
      const poolName = source?.connectionPoolName ?? this.metricString(source?.attributes?.['db.client.connection.pool.name']) ?? 'unknown';
      const value = Number(source?.value);
      if (!timestamp || !service || !Number.isFinite(value) || value < 0) return [];
      return [{
        timestamp,
        service,
        poolName,
        waitTimeMs: value * 1000,
      }];
    });
  }

  private describeDatabaseConnectionWait(
    candidate: ReturnType<typeof detectDatabaseConnectionWait>[number],
  ): string {
    const regression = candidate.signal.p95ChangePercent !== undefined
      ? ' P95 wait time changed by ' + candidate.signal.p95ChangePercent.toFixed(0) + '% from baseline.'
      : '';
    return candidate.poolName + ' has a P95 connection acquisition wait of ' +
      candidate.signal.p95WaitMs.toFixed(0) + 'ms across ' +
      candidate.signal.sampleCount + ' observations.' + regression;
  }

  private async searchRequestEndpoints(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<Map<string, string>> {
    const result = await this.quickwit.search<RequestSource>(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(orgId, projectId),
      startTimestamp,
      endTimestamp,
      maxHits: 5000,
      sortBy: ['timestamp'],
    });

    const endpoints = new Map<string, string>();
    for (const hit of result.hits ?? []) {
      const source = hit._source;
      const traceId = source?.traceId;
      if (!traceId) continue;

      const route = String(source?.url ?? '').trim();
      if (!route) continue;

      const sanitized = sanitizeRequestUrl(route);
      if (sanitized) endpoints.set(String(traceId), sanitized);
    }

    return endpoints;
  }

  private async searchDatabaseQuerySpans(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<DatabaseQueryTrace[]> {
    const result = await this.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(
        orgId,
        projectId,
        quickwitTerm('dependencyType', 'database'),
      ),
      startTimestamp,
      endTimestamp,
      maxHits: 5000,
      sortBy: ['-duration'],
    });

    return (result.hits ?? []).flatMap((hit) => {
      const source = hit._source;
      if (!source?.traceId || !source.service) return [];

      const query = source.dbQueryText;
      const summary = source.dbQuerySummary;
      const operation = source.dbOperationName;
      const system = source.dbSystemName;
      const collection = source.dbCollectionName;
      const returnedRows = Number.isFinite(source.dbReturnedRows) ? source.dbReturnedRows : undefined;
      const batchSize = Number.isFinite(source.dbBatchSize) ? source.dbBatchSize : undefined;
      const responseBytes = Number.isFinite(source.dbResponseBytes) ? source.dbResponseBytes : undefined;
      const endpoint = source.httpRoute ?? source.endpoint;

      const dependencyName = String(source.dependencyName ?? system ?? source.name ?? '');
      const queryIdentity = query ?? summary ?? operation ?? dependencyName;
      if (!queryIdentity) return [];

      return [{
        timestamp: String(source.timestamp ?? ''),
        service: String(source.service),
        traceId: String(source.traceId),
        spanId: String(source.spanId ?? ''),
        ...(source.parentSpanId ? { parentSpanId: String(source.parentSpanId) } : {}),
        duration: Number(source.duration ?? 0),
        ...(Number.isFinite(source.statusCode) ? { statusCode: Number(source.statusCode) } : {}),
        ...(source.statusMessage ? { statusMessage: String(source.statusMessage) } : {}),
        ...(source.errorType ? { errorType: String(source.errorType) } : {}),
        dependencyType: 'database',
        dependencyName,
        ...(source.name ? { spanName: String(source.name) } : {}),
        ...(query ? { dbQueryText: query } : {}),
        ...(summary ? { dbQuerySummary: summary } : {}),
        ...(operation ? { dbOperationName: operation } : {}),
        ...(system ? { dbSystemName: system } : {}),
        ...(collection ? { dbCollectionName: collection } : {}),
        ...(returnedRows !== undefined ? { dbReturnedRows: returnedRows } : {}),
        ...(batchSize !== undefined ? { dbBatchSize: batchSize } : {}),
        ...(responseBytes !== undefined ? { dbResponseBytes: responseBytes } : {}),
        ...(endpoint ? { httpRoute: endpoint, endpoint } : {}),
      }];
    });
  }

  private describeDatabaseQuery(
    candidate: ReturnType<typeof detectDatabaseQueries>[number],
  ): string {
    const baseline = candidate.signal.baselineValue;
    const change = candidate.signal.changePercent;
    const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;

    if (baseline !== undefined && change !== undefined) {
      return queryLabel + ' reached a p95 latency of ' +
        Math.round(candidate.signal.observedValue) + 'ms, up ' +
        change.toFixed(0) + '% from the previous comparable window (' +
        Math.round(baseline) + 'ms).';
    }

    return queryLabel + ' reached a p95 latency of ' +
      Math.round(candidate.signal.observedValue) + 'ms.';
  }

  private describeDatabaseLatencyContribution(
    candidate: ReturnType<typeof detectDatabaseLatencyContribution>[number],
  ): string {
    const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
    return queryLabel +
      ' accounts for ' +
      candidate.signal.p95ContributionPercent.toFixed(0) +
      '% of trace duration at p95, with ' +
      candidate.signal.p95DurationMs.toFixed(0) +
      'ms of database time.';
  }

  private describeDatabaseResultSet(
    candidate: ReturnType<typeof detectDatabaseResultSets>['candidates'][number],
  ): string {
    const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
    const endpoint = candidate.endpoint ? ' on ' + candidate.endpoint : '';
    const regression = candidate.signal.regressionDetected && candidate.signal.p95RowsChangePercent !== undefined
      ? ' P95 returned rows increased by ' + candidate.signal.p95RowsChangePercent.toFixed(0) + '% from the comparable baseline.'
      : '';
    const contribution = candidate.signal.p95TraceContributionPercent !== undefined
      ? ' Database time contributes ' + candidate.signal.p95TraceContributionPercent.toFixed(0) + '% of trace duration at p95.'
      : '';
    return queryLabel + endpoint + ' returns ' +
      Math.round(candidate.signal.p95ReturnedRows) + ' rows at p95 and ' +
      Math.round(candidate.signal.p99ReturnedRows) + ' at p99 across ' +
      candidate.signal.sampleCount + ' executions.' + regression + contribution;
  }

  private describeDatabaseBatch(
    candidate: ReturnType<typeof detectDatabaseBatches>[number],
  ): string {
    const regression = candidate.signal.p95DurationChangePercent !== undefined
      ? ' P95 database duration changed by ' + candidate.signal.p95DurationChangePercent.toFixed(0) + '% from baseline.'
      : '';
    const contribution = candidate.signal.p95TraceContributionPercent !== undefined
      ? ' P95 database contribution is ' + candidate.signal.p95TraceContributionPercent.toFixed(0) + '% of trace duration.'
      : '';
    return (candidate.querySummary ?? candidate.queryOperation ?? candidate.query) +
      ' ran as a batch across ' + candidate.signal.sampleCount + ' executions with an average batch size of ' +
      candidate.signal.averageBatchSize.toFixed(1) + ' (' + candidate.signal.logicalOperationCount + ' logical operations).' +
      regression + contribution;
  }

  private describeDatabaseTimeout(
    candidate: ReturnType<typeof detectDatabaseTimeouts>[number],
  ): string {
    const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
    return queryLabel + ' timed out ' + candidate.signal.timeoutCount + ' times out of ' + candidate.signal.totalCount + ' executions (' + (candidate.signal.timeoutRate * 100).toFixed(1) + '%).';
  }

  private describeDatabaseError(
    candidate: ReturnType<typeof detectDatabaseErrors>[number],
  ): string {
    const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
    return queryLabel +
      ' failed ' +
      candidate.signal.errorCount +
      ' times out of ' +
      candidate.signal.totalCount +
      ' executions, for a ' +
      (candidate.signal.errorRate * 100).toFixed(1) +
      '% database error rate.';
  }

  private describeDatabaseQueryVolume(
    candidate: ReturnType<typeof detectDatabaseQueryVolume>[number],
  ): string {
    const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
    return queryLabel +
      ' ran ' +
      candidate.signal.currentCount +
      ' times in the current window versus ' +
      candidate.signal.baselineCount +
      ' in the previous comparable window, a ' +
      candidate.signal.relativeIncrease.toFixed(0) +
      '% increase.';
  }

  private describeNPlusOne(
    candidate: ReturnType<typeof detectNPlusOne>[number],
  ): string {
    const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
    return queryLabel +
      ' was executed ' +
      candidate.signal.occurrences +
      ' times in one trace under the same parent span, consuming about ' +
      Math.round(candidate.signal.totalDurationMs) +
      'ms of database time.';
  }

  private async searchTraceDurations(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<Map<string, number>> {
    const result = await this.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
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

    return new Map(
      Array.from(traces.entries())
        .map(([traceId, value]) => [traceId, value.end - value.start] as const)
        .filter(([, duration]) => duration > 0),
    );
  }

  private async searchTraceSpanCandidates(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<Array<{
    traceId: string;
    spanId: string;
    spanName: string;
    serviceName: string;
    spanDuration: number;
    traceDuration: number;
  }>> {
    const result = await this.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(orgId, projectId),
      startTimestamp,
      endTimestamp,
      maxHits: 5000,
      sortBy: ['-duration'],
    });

    const traces = new Map<string, {
      start: number;
      end: number;
      rootService: string;
      spans: TraceSource[];
    }>();

    for (const hit of result.hits) {
      const source = hit._source;
      if (!source?.traceId) continue;

      const trace = traces.get(source.traceId) ?? {
        start: Number.POSITIVE_INFINITY,
        end: 0,
        rootService: String(source.service ?? ''),
        spans: [],
      };
      trace.spans.push(source);

      const startMs = new Date(String(source.timestamp ?? '')).getTime();
      const duration = Number(source.duration ?? 0);
      if (Number.isFinite(startMs) && Number.isFinite(duration) && duration > 0) {
        trace.start = Math.min(trace.start, startMs);
        trace.end = Math.max(trace.end, startMs + duration);
      }

      if (!source.parentSpanId) {
        trace.rootService = String(source.service ?? trace.rootService);
      }

      traces.set(source.traceId, trace);
    }

    return Array.from(traces.entries()).flatMap(([traceId, trace]) => {
      const starts = trace.spans
        .map((span) => new Date(String(span.timestamp ?? '')).getTime())
        .filter(Number.isFinite);
      if (!starts.length || trace.duration <= Math.min(...starts)) return [];

      const traceDuration = trace.duration - Math.min(...starts);
      const candidate = trace.spans
        .filter((span) => Number(span.duration ?? 0) > 0)
        .sort((a, b) => Number(b.duration ?? 0) - Number(a.duration ?? 0))[0];

      if (!candidate) return [];

      return [{
        traceId,
        spanId: String(candidate.spanId ?? ''),
        spanName: String(candidate.name ?? ''),
        serviceName: String(candidate.service ?? trace.rootService),
        spanDuration: Number(candidate.duration ?? 0),
        traceDuration,
      }];
    });
  }

  private dependencyRecommendation(dependencyType: string): string {
    switch (dependencyType) {
      case 'database':
        return 'Inspect the query shape and database plan first. Check for N+1 queries, missing indexes, excessive reads or selected fields, offset pagination, and repeated queries. Use EXPLAIN ANALYZE before changing the query or schema.';
      case 'http':
        return 'Inspect downstream latency, request payload size, retries, timeouts, and connection reuse. Avoid retry amplification and reduce unnecessary payload or downstream calls where possible.';
      case 'rpc':
        return 'Inspect downstream RPC latency, retry behavior, timeouts, connection reuse, and whether multiple calls can be batched or avoided.';
      default:
        return 'Inspect the downstream operation and trace its latency contribution before changing the caller. Check for repeated calls, unnecessary work, and connection or pooling issues.';
    }
  }

  private async dependencyEvidence(
    orgId: string,
    projectId: string,
    serviceName: string,
    dependencyType: string,
    dependencyName: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<DetectionEvidence[]> {
    const query = quickwitTenantQuery(
      orgId,
      projectId,
      [
        quickwitTerm('service', serviceName),
        quickwitTerm('spanKind', '3'),
        quickwitTerm('dependencyType', dependencyType),
        quickwitTerm('dependencyName', dependencyName),
      ].join(' AND '),
    );

    const result = await this.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
      query,
      startTimestamp,
      endTimestamp,
      maxHits: 5,
      sortBy: ['duration:desc'],
    });

    return result.hits.flatMap((hit) => {
      const source = hit._source;
      if (!source) return [];

      return [{
        kind: 'trace',
        label: 'slow-dependency-span',
        value: Number(source.duration ?? 0),
        context: {
          service: String(source.service ?? serviceName),
          dependencyType,
          dependencyName,
          traceId: String(source.traceId ?? ''),
          spanId: String(source.spanId ?? ''),
          spanName: String(source.name ?? ''),
          timestamp: String(source.timestamp ?? ''),
        },
      }];
    });
  }

  private describePerformanceSignal(signal: ReturnType<typeof evaluateServicePerformance>): string {
    if (!signal) return 'Service performance degraded over the last 15 minutes.';

    return signal.reasons.join('. ') + '. P50: ' +
      Math.round(signal.latency.p50) + 'ms, P95: ' +
      Math.round(signal.latency.p95) + 'ms, P99: ' +
      Math.round(signal.latency.p99) + 'ms.';
  }

  private describeSignal(
    description: string,
    signal: ReturnType<typeof evaluateSignal>,
  ): string {
    if (signal?.baselineValue === undefined || signal.changePercent === undefined) {
      return description;
    }

    return description + ' This is a ' + signal.changePercent.toFixed(0) + '% increase from the previous comparable window.';
  }

  private describeThroughputSignal(signal: ReturnType<typeof evaluateThroughput>): string {
    if (!signal) return 'Request throughput degraded over the last 15 minutes.';

    return 'Request throughput fell from an expected ' + Math.round(signal.baselineValue) + ' requests to ' + Math.round(signal.observedValue) + ' requests over the last 15 minutes (' + signal.changePercent.toFixed(0) + '%).';
  }

  private async assertProjectAccess(orgId: string, projectId: string): Promise<void> {

    const project = await this.projectsRepository.getProjectById(projectId, orgId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private async requestEvidence(
    orgId: string,
    projectId: string,
    serviceName: string,
    startTimestamp: number,
    endTimestamp: number,
    type: FindingType,
  ): Promise<DetectionEvidence[]> {
    const tenant = quickwitTenantQuery(orgId, projectId);
    const service = quickwitTerm('service', serviceName);
    const query = type === 'latency'
      ? tenant + ' AND ' + service
      : tenant + ' AND ' + service + ' AND statusCode:[500 TO 599]';

    const result = await this.quickwit.search<RequestSource>(QUICKWIT_INDEXES.requests, {
      query,
      startTimestamp,
      endTimestamp,
      maxHits: 5,
      sortBy: type === 'latency' ? ['duration:desc'] : ['timestamp:desc'],
    });

    return result.hits.flatMap((hit) => {
      const source = hit._source;
      if (!source) return [];
      return [{
        kind: 'request',
        label: type === 'latency' ? 'slow-request' : 'error-request',
        value: type === 'latency' ? Number(source.duration ?? 0) : Number(source.statusCode ?? 0),
        context: {
          service: String(source.service ?? serviceName),
          method: String(source.method ?? ''),
          path: sanitizeRequestUrl(String(source.url ?? '')),
          statusCode: Number(source.statusCode ?? 0),
          traceId: String(source.traceId ?? ''),
          timestamp: String(source.timestamp ?? ''),
        },
      }];
    });
  }

  private toDetectionFinding(row: typeof findings.$inferSelect): DetectionFinding {
    return {
      id: row.id,
      projectId: row.projectId,
      serviceName: row.serviceName,
      type: row.type as FindingType,
      severity: row.severity as FindingSeverity,
      title: row.title,
      description: row.description,
      observedValue: row.observedValue,
      threshold: row.threshold,
      unit: row.unit,
      window: {
        start: row.windowStart,
        end: row.windowEnd,
      },
      evidence: row.evidence,
    };
  }

  private async persistFinding(input: {
    orgId: string;
    projectId: string;
    serviceName: string;
    type: FindingType;
    severity: FindingSeverity;
    title: string;
    description: string;
    observedValue: number;
    threshold: number;
    unit: string;
    start: Date;
    end: Date;
    evidence: DetectionEvidence[];
  }): Promise<DetectionFinding> {
    const [row] = await db
      .insert(findings)
      .values({
        orgId: input.orgId,
        projectId: input.projectId,
        serviceName: input.serviceName,
        type: input.type,
        severity: input.severity,
        title: input.title,
        description: input.description,
        observedValue: input.observedValue,
        threshold: input.threshold,
        unit: input.unit,
        windowStart: input.start,
        windowEnd: input.end,
        evidence: input.evidence,
      })
      .returning();

    if (!row) throw new Error('Failed to persist detection finding');

    return {
      id: row.id,
      projectId: row.projectId,
      serviceName: row.serviceName,
      type: row.type as FindingType,
      severity: row.severity as FindingSeverity,
      title: row.title,
      description: row.description,
      observedValue: row.observedValue,
      threshold: row.threshold,
      unit: row.unit,
      window: {
        start: row.windowStart,
        end: row.windowEnd,
      } satisfies DetectionWindow,
      evidence: row.evidence,
    };
  }
}

