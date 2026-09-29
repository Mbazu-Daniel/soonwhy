import { fingerprintQuery } from './query-fingerprint';

export interface DatabaseResultSetTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  returnedRows?: number;
  responseBytes?: number;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  endpoint?: string;
}

export interface DatabaseResultSetDistribution {
  p50: number;
  p95: number;
  p99: number;
}

export interface DatabaseResultSetSignal {
  sampleCount: number;
  p50ReturnedRows: number;
  p95ReturnedRows: number;
  p99ReturnedRows: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  largeResultRate: number;
  largeResultRows: number;
  current?: DatabaseResultSetDistribution;
  baseline?: DatabaseResultSetDistribution;
  baselineSampleCount?: number;
  p95RowsChangePercent?: number;
  p99RowsChangePercent?: number;
  p95DurationChangePercent?: number;
  p99DurationChangePercent?: number;
  regressionDetected: boolean;
  confidence: 'low' | 'medium' | 'high';
  evidenceReasons: string[];
}

export interface DatabaseResultSetCandidate {
  serviceName: string;
  signal: DatabaseResultSetSignal;
  identity: ReturnType<typeof fingerprintQuery>['identity'];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  endpoint?: string;
  payloadBytes?: DatabaseResultSetDistribution;
  samples: DatabaseResultSetTrace[];
  recommendation: {
    action: 'pagination' | 'projection' | 'bounded-query' | 'inspect-payload' | 'benchmark';
    guidance: string;
    validation: string;
  };
}

export interface DatabaseResultSetDetectionResult {
  candidates: DatabaseResultSetCandidate[];
  insufficientEvidence: Array<{
    serviceName: string;
    fingerprint?: string;
    reason: string;
    sampleCount: number;
  }>;
}

const MINIMUM_SAMPLES = 5;
const LARGE_RESULT_ROWS = 1_000;
const CRITICAL_RESULT_ROWS = 5_000;
const MINIMUM_LARGE_RESULT_RATE = 0.2;
const REGRESSION_P95_ROWS_PERCENT = 100;
const REGRESSION_P99_ROWS_PERCENT = 100;
const REGRESSION_DURATION_PERCENT = 50;

export function detectDatabaseResultSets(
  samples: DatabaseResultSetTrace[],
  baselineSamples: DatabaseResultSetTrace[] = [],
): DatabaseResultSetDetectionResult {
  const currentGroups = groupSamples(samples);
  const baselineGroups = groupSamples(baselineSamples);
  const candidates: DatabaseResultSetCandidate[] = [];
  const insufficientEvidence: DatabaseResultSetDetectionResult['insufficientEvidence'] = [];

  for (const [key, group] of currentGroups) {
    const first = group[0];
    if (!first) continue;
    const fingerprint = fingerprintQuery(queryFor(first), first.dbSystemName).identity;

    if (group.length < MINIMUM_SAMPLES) {
      insufficientEvidence.push({ serviceName: first.service, fingerprint: fingerprint.fingerprint, reason: 'sample_count_below_minimum', sampleCount: group.length });
      continue;
    }

    const current = distribution(group);
    const largeResultRate = group.filter((sample) => (sample.returnedRows ?? 0) >= LARGE_RESULT_ROWS).length / group.length;
    const baselineGroup = baselineGroups.get(key) ?? [];
    const baseline = baselineGroup.length >= MINIMUM_SAMPLES ? distribution(baselineGroup) : undefined;
    const p95RowsChangePercent = percentChange(current.p95, baseline?.p95);
    const p99RowsChangePercent = percentChange(current.p99, baseline?.p99);
    const p95DurationChangePercent = percentChange(current.p95, baseline?.p95);
    const p99DurationChangePercent = percentChange(current.p99, baseline?.p99);
    const regressionDetected =
      (p95RowsChangePercent !== undefined && p95RowsChangePercent >= REGRESSION_P95_ROWS_PERCENT) ||
      (p99RowsChangePercent !== undefined && p99RowsChangePercent >= REGRESSION_P99_ROWS_PERCENT) ||
      (p95DurationChangePercent !== undefined && p95DurationChangePercent >= REGRESSION_DURATION_PERCENT) ||
      (p99DurationChangePercent !== undefined && p99DurationChangePercent >= REGRESSION_DURATION_PERCENT);

    const largeResultDetected = current.p95 >= LARGE_RESULT_ROWS && largeResultRate >= MINIMUM_LARGE_RESULT_RATE;
    if (!largeResultDetected && !regressionDetected) {
      insufficientEvidence.push({ serviceName: first.service, fingerprint: fingerprint.fingerprint, reason: baseline ? 'result_set_not_actionable' : 'result_set_not_large_or_regressing', sampleCount: group.length });
      continue;
    }

    const reasons: string[] = [];
    if (largeResultDetected) reasons.push('repeated_large_result_set');
    if (regressionDetected) reasons.push('result_set_or_duration_regression');
    if (baselineGroup.length < MINIMUM_SAMPLES && baselineSamples.length > 0) reasons.push('baseline_insufficient');
    if (group.some((sample) => sample.endpoint)) reasons.push('endpoint_context_available');
    if (group.some((sample) => sample.responseBytes !== undefined)) reasons.push('payload_size_available');

    const confidence = regressionDetected && largeResultRate >= 0.5
      ? 'high'
      : largeResultRate >= 0.5 || regressionDetected
        ? 'medium'
        : 'low';

    const payloadValues = group.map((sample) => sample.responseBytes).filter((value): value is number => value !== undefined && Number.isFinite(value) && value >= 0);

    candidates.push({
      serviceName: first.service,
      signal: {
        sampleCount: group.length,
        p50ReturnedRows: current.p50,
        p95ReturnedRows: current.p95,
        p99ReturnedRows: current.p99,
        p50Duration: current.p50,
        p95Duration: current.p95,
        p99Duration: current.p99,
        largeResultRate,
        largeResultRows: LARGE_RESULT_ROWS,
        current,
        ...(baseline ? { baseline, baselineSampleCount: baselineGroup.length } : {}),
        ...(p95RowsChangePercent !== undefined ? { p95RowsChangePercent } : {}),
        ...(p99RowsChangePercent !== undefined ? { p99RowsChangePercent } : {}),
        ...(p95DurationChangePercent !== undefined ? { p95DurationChangePercent } : {}),
        ...(p99DurationChangePercent !== undefined ? { p99DurationChangePercent } : {}),
        regressionDetected,
        confidence,
        evidenceReasons: reasons,
      },
      identity: fingerprint,
      query: queryFor(first),
      ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
      ...(first.dbOperationName ? { queryOperation: first.dbOperationName } : {}),
      ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
      ...(first.dbCollectionName ? { collectionName: first.dbCollectionName } : {}),
      ...(first.endpoint ? { endpoint: first.endpoint } : {}),
      ...(payloadValues.length >= MINIMUM_SAMPLES ? { payloadBytes: distribution(payloadValues.map((value, index) => ({ returnedRows: value, duration: value }))) } : {}),
      samples: group.slice(0, 20),
      recommendation: recommendationFor(current.p95, current.p99, largeResultRate, regressionDetected),
    });
  }

  return {
    candidates: candidates
      .sort((a, b) => b.signal.p99ReturnedRows - a.signal.p99ReturnedRows)
      .slice(0, 100),
    insufficientEvidence: insufficientEvidence.slice(0, 100),
  };
}

function groupSamples(samples: DatabaseResultSetTrace[]): Map<string, DatabaseResultSetTrace[]> {
  const groups = new Map<string, DatabaseResultSetTrace[]>();
  for (const sample of samples) {
    if (
      sample.dependencyType !== 'database' ||
      !sample.service ||
      sample.returnedRows === undefined ||
      !Number.isFinite(sample.returnedRows) ||
      sample.returnedRows < 0 ||
      !Number.isFinite(sample.duration) ||
      sample.duration <= 0
    ) continue;

    const identity = fingerprintQuery(queryFor(sample), sample.dbSystemName).identity;
    const key = [sample.service, identity.fingerprint, identity.fingerprintVersion, sample.dbSystemName ?? ''].join('\0');
    const existing = groups.get(key) ?? [];
    existing.push(sample);
    groups.set(key, existing);
  }
  return groups;
}

function queryFor(sample: DatabaseResultSetTrace): string {
  return sample.dbQueryText ?? sample.dbQuerySummary ?? sample.dbOperationName ?? sample.dependencyName;
}

function distribution(samples: DatabaseResultSetTrace[] | Array<{ returnedRows: number; duration: number }>): DatabaseResultSetDistribution {
  const rows = samples.map((sample) => 'returnedRows' in sample ? sample.returnedRows : sample.returnedRows).filter(Number.isFinite).sort((a, b) => a - b);
  const durations = samples.map((sample) => 'duration' in sample ? sample.duration : sample.duration).filter(Number.isFinite).sort((a, b) => a - b);
  return { p50: percentile(rows, 0.5), p95: percentile(rows, 0.95), p99: percentile(rows, 0.99) };
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

function recommendationFor(p95Rows: number, p99Rows: number, largeResultRate: number, regression: boolean): DatabaseResultSetCandidate['recommendation'] {
  if (p99Rows >= CRITICAL_RESULT_ROWS || largeResultRate >= 0.8) {
    return {
      action: 'pagination',
      guidance: 'Bound the result set first. Prefer pagination or another bounded access pattern; if the endpoint only needs selected fields, narrow the projection as well.',
      validation: 'Compare p50/p95/p99 returned rows, endpoint latency, DB time, and payload size before and after the change. Validate the query plan where relevant.',
    };
  }
  if (p95Rows >= LARGE_RESULT_ROWS) {
    return {
      action: 'projection',
      guidance: 'Inspect whether the query returns fields or rows the caller does not need. Narrow the projection and add a bounded query or pagination where appropriate.',
      validation: 'Benchmark the same query shape and compare p50/p95/p99 rows and duration. Do not treat lower latency alone as proof of correctness.',
    };
  }
  if (regression) {
    return {
      action: 'benchmark',
      guidance: 'Treat this as a regression candidate. Compare the current query shape with the baseline before changing indexes or query structure.',
      validation: 'Run a controlled benchmark and compare the current and baseline p50/p95/p99 distributions, DB contribution, and request latency.',
    };
  }
  return {
    action: 'inspect-payload',
    guidance: 'Inspect result-set size and payload characteristics before changing the database access path.',
    validation: 'Confirm that any change reduces the measured result-set or payload cost without changing required response semantics.',
  };
}
