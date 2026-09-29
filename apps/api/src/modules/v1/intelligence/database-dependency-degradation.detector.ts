import type { DatabaseConnectionPoolSample } from './database-connection-pool.detector';
import type { DatabaseConnectionWaitSample } from './database-connection-wait.detector';
import { fingerprintQuery } from './query-fingerprint';

export interface DatabaseDependencyTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  statusCode?: number;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbBatchSize?: number;
}

export interface DatabaseDependencySignal {
  sampleCount: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorCount: number;
  errorRate: number;
  p95DurationChangePercent?: number;
  poolPressure: boolean;
  connectionWaitPressure: boolean;
  batchOperationCount: number;
  batchRate: number;
  averageBatchSize?: number;
  queryFingerprintCount: number;
  degradationSignals: string[];
  confidence: 'medium' | 'high';
}

export interface DatabaseDependencyCandidate {
  serviceName: string;
  dependencyName: string;
  databaseSystem?: string;
  signal: DatabaseDependencySignal;
  samples: DatabaseDependencyTrace[];
  recommendation: string;
}

const MINIMUM_SAMPLES = 5;
const LATENCY_THRESHOLD_MS = 500;
const LATENCY_REGRESSION_PERCENT = 50;
const ERROR_RATE_THRESHOLD = 0.1;
const CONNECTION_WAIT_THRESHOLD_MS = 50;
const POOL_UTILIZATION_THRESHOLD = 80;
const POOL_PENDING_THRESHOLD = 1;

export function detectDatabaseDependencyDegradation(
  samples: DatabaseDependencyTrace[],
  baselineSamples: DatabaseDependencyTrace[] = [],
  poolSamples: DatabaseConnectionPoolSample[] = [],
  waitSamples: DatabaseConnectionWaitSample[] = [],
): DatabaseDependencyCandidate[] {
  const currentGroups = groupByDependency(samples);
  const baselineGroups = groupByDependency(baselineSamples);
  const poolPressure = detectPoolPressure(poolSamples);
  const waitPressure = detectWaitPressure(waitSamples);

  return Array.from(currentGroups.entries())
    .flatMap(([key, current]) => {
      const first = current[0];
      if (!first || current.length < MINIMUM_SAMPLES) return [];

      const durations = distribution(current.map((sample) => sample.duration));
      const errors = current.filter((sample) => sample.statusCode === 2).length;
      const errorRate = errors / current.length;
      const baseline = baselineGroups.get(key);
      const baselineP95 = baseline && baseline.length >= MINIMUM_SAMPLES
        ? percentile(baseline.map((sample) => sample.duration), 0.95)
        : undefined;
      const p95DurationChangePercent = percentChange(durations.p95, baselineP95);
      const latencyDegraded =
        durations.p95 >= LATENCY_THRESHOLD_MS ||
        (p95DurationChangePercent !== undefined && p95DurationChangePercent >= LATENCY_REGRESSION_PERCENT);
      const errorDegraded = errorRate >= ERROR_RATE_THRESHOLD;
      const poolDegraded = poolPressure.has(first.service);
      const waitDegraded = waitPressure.has(first.service);
      const signals = [
        ...(latencyDegraded ? ['latency'] : []),
        ...(errorDegraded ? ['errors'] : []),
        ...(poolDegraded ? ['connection_pool'] : []),
        ...(waitDegraded ? ['connection_wait'] : []),
      ];

      if (signals.length < 2) return [];

      const batchSamples = current.filter((sample) => sample.dbBatchSize !== undefined && sample.dbBatchSize >= 2);
      const fingerprints = new Set(
        current
          .map((sample) => sample.dbQueryText ?? sample.dbQuerySummary ?? sample.dbOperationName)
          .filter((query): query is string => Boolean(query))
          .map((query) => fingerprintQuery(query, first.dbSystemName).identity.fingerprint),
      );

      const confidence = signals.length >= 3 ? 'high' : 'medium';
      const recommendation = latencyDegraded && errorDegraded
        ? 'Inspect the affected database dependency for query latency and database errors first, then correlate pool pressure and connection wait before changing query or pool configuration.'
        : poolDegraded || waitDegraded
          ? 'Inspect connection capacity and wait pressure alongside the slow or failing database operations. Validate whether pool contention explains the dependency degradation.'
          : 'Compare the affected database dependency with its baseline and inspect the query and batch shapes contributing to the degradation.';

      return [{
        serviceName: first.service,
        dependencyName: first.dependencyName,
        ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
        signal: {
          sampleCount: current.length,
          p50Duration: durations.p50,
          p95Duration: durations.p95,
          p99Duration: durations.p99,
          errorCount: errors,
          errorRate,
          ...(p95DurationChangePercent !== undefined ? { p95DurationChangePercent } : {}),
          poolPressure: poolDegraded,
          connectionWaitPressure: waitDegraded,
          batchOperationCount: batchSamples.length,
          batchRate: batchSamples.length / current.length,
          ...(batchSamples.length ? {
            averageBatchSize: batchSamples.reduce((sum, sample) => sum + (sample.dbBatchSize ?? 0), 0) / batchSamples.length,
          } : {}),
          queryFingerprintCount: fingerprints.size,
          degradationSignals: signals,
          confidence,
        },
        samples: current.slice(0, 20),
        recommendation,
      }];
    })
    .sort((left, right) => right.signal.p95Duration - left.signal.p95Duration)
    .slice(0, 100);
}

function groupByDependency(samples: DatabaseDependencyTrace[]): Map<string, DatabaseDependencyTrace[]> {
  const groups = new Map<string, DatabaseDependencyTrace[]>();

  for (const sample of samples) {
    if (
      sample.dependencyType !== 'database' ||
      !sample.service ||
      !sample.dependencyName ||
      !Number.isFinite(sample.duration) ||
      sample.duration <= 0
    ) continue;

    const key = [
      sample.service,
      sample.dependencyName,
      sample.dbSystemName ?? '',
    ].join('\0');
    const existing = groups.get(key) ?? [];
    existing.push(sample);
    groups.set(key, existing);
  }

  return groups;
}

function detectPoolPressure(samples: DatabaseConnectionPoolSample[]): Set<string> {
  const pressure = new Set<string>();

  for (const sample of samples) {
    if (
      !sample.service ||
      (sample.usedConnections === undefined || sample.maxConnections === undefined || sample.maxConnections <= 0)
        && (sample.pendingRequests === undefined || sample.pendingRequests < POOL_PENDING_THRESHOLD)
    ) continue;

    const utilization = sample.usedConnections !== undefined && sample.maxConnections !== undefined && sample.maxConnections > 0
      ? (sample.usedConnections / sample.maxConnections) * 100
      : 0;

    if (utilization >= POOL_UTILIZATION_THRESHOLD || (sample.pendingRequests ?? 0) >= POOL_PENDING_THRESHOLD) {
      pressure.add(sample.service);
    }
  }

  return pressure;
}

function detectWaitPressure(samples: DatabaseConnectionWaitSample[]): Set<string> {
  return new Set(
    samples
      .filter((sample) => sample.waitTimeMs >= CONNECTION_WAIT_THRESHOLD_MS)
      .map((sample) => sample.service),
  );
}

function distribution(values: number[]): { p50: number; p95: number; p99: number } {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  const position = (values.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = values[lower] ?? 0;
  const upperValue = values[upper] ?? lowerValue;
  return lower === upper ? lowerValue : lowerValue + (upperValue - lowerValue) * (position - lower);
}

function percentChange(current: number, baseline: number | undefined): number | undefined {
  if (baseline === undefined || baseline <= 0) return undefined;
  return ((current - baseline) / baseline) * 100;
}
