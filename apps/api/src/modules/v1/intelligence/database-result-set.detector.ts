import { fingerprintQuery } from './query-fingerprint';

export interface DatabaseResultSetTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  traceDuration?: number;
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
  current: DatabaseResultSetDistribution;
  baseline?: DatabaseResultSetDistribution;
  baselineSampleCount?: number;
  p95RowsChangePercent?: number;
  p99RowsChangePercent?: number;
  p95DurationChangePercent?: number;
  p99DurationChangePercent?: number;
  p95TraceContributionPercent?: number;
  p99TraceContributionPercent?: number;
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
const TRACE_CONTRIBUTION_PERCENT = 50;

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
    const identity = fingerprintQuery(queryFor(first), first.dbSystemName).identity;

    if (group.length < MINIMUM_SAMPLES) {
      insufficientEvidence.push({ serviceName: first.service, fingerprint: identity.fingerprint, reason: 'sample_count_below_minimum', sampleCount: group.length });
      continue;
    }

    const currentRows = distribution(group.map((sample) => sample.returnedRows ?? 0));
    const currentDuration = distribution(group.map((sample) => sample.duration));
    const largeResultRate = group.filter((sample) => (sample.returnedRows ?? 0) >= LARGE_RESULT_ROWS).length / group.length;
    const baselineGroup = baselineGroups.get(key) ?? [];
    const baseline = baselineGroup.length >= MINIMUM_SAMPLES ? distributionPair(baselineGroup) : undefined;
    const p95RowsChangePercent = percentChange(currentRows.p95, baseline?.rows.p95);
    const p99RowsChangePercent = percentChange(currentRows.p99, baseline?.rows.p99);
    const p95DurationChangePercent = percentChange(currentDuration.p95, baseline?.duration.p95);
    const p99DurationChangePercent = percentChange(currentDuration.p99, baseline?.duration.p99);
    const p95TraceContributionPercent = percentileTraceContribution(group, 0.95);
    const p99TraceContributionPercent = percentileTraceContribution(group, 0.99);
    const regressionDetected =
      (p95RowsChangePercent !== undefined && p95RowsChangePercent >= REGRESSION_P95_ROWS_PERCENT) ||
      (p99RowsChangePercent !== undefined && p99RowsChangePercent >= REGRESSION_P99_ROWS_PERCENT) ||
      (p95DurationChangePercent !== undefined && p95DurationChangePercent >= REGRESSION_DURATION_PERCENT) ||
      (p99DurationChangePercent !== undefined && p99DurationChangePercent >= REGRESSION_DURATION_PERCENT);

    const largeResultDetected = currentRows.p95 >= LARGE_RESULT_ROWS && largeResultRate >= MINIMUM_LARGE_RESULT_RATE;
    const traceContributionDetected = (p95TraceContributionPercent ?? 0) >= TRACE_CONTRIBUTION_PERCENT;
    if (!largeResultDetected && !regressionDetected && !traceContributionDetected) {
      insufficientEvidence.push({ serviceName: first.service, fingerprint: identity.fingerprint, reason: baseline ? 'result_set_not_actionable' : 'result_set_not_large_or_regressing', sampleCount: group.length });
      continue;
    }

    const reasons: string[] = [];
    if (largeResultDetected) reasons.push('repeated_large_result_set');
    if (regressionDetected) reasons.push('result_set_or_duration_regression');
    if (traceContributionDetected) reasons.push('database_time_is_material_to_trace_latency');
    if (baselineGroup.length < MINIMUM_SAMPLES && baselineSamples.length > 0) reasons.push('baseline_insufficient');
    if (group.some((sample) => sample.endpoint)) reasons.push('endpoint_context_available');
    if (group.some((sample) => sample.responseBytes !== undefined)) reasons.push('payload_size_available');

    const confidence = regressionDetected && (largeResultRate >= 0.5 || traceContributionDetected)
      ? 'high'
      : largeResultRate >= 0.5 || regressionDetected || traceContributionDetected
        ? 'medium'
        : 'low';

    const payloadValues = group
      .map((sample) => sample.responseBytes)
      .filter((value): value is number => value !== undefined && Number.isFinite(value) && value >= 0);

    candidates.push({
      serviceName: first.service,
      signal: {
        sampleCount: group.length,
        p50ReturnedRows: currentRows.p50,
        p95ReturnedRows: currentRows.p95,
        p99ReturnedRows: currentRows.p99,
        p50Duration: currentDuration.p50,
        p95Duration: currentDuration.p95,
        p99Duration: currentDuration.p99,
        largeResultRate,
        largeResultRows: LARGE_RESULT_ROWS,
        current: currentRows,
        ...(baseline ? { baseline: baseline.rows, baselineSampleCount: baselineGroup.length } : {}),
        ...(p95RowsChangePercent !== undefined ? { p95RowsChangePercent } : {}),
        ...(p99RowsChangePercent !== undefined ? { p99RowsChangePercent } : {}),
        ...(p95DurationChangePercent !== undefined ? { p95DurationChangePercent } : {}),
        ...(p99DurationChangePercent !== undefined ? { p99DurationChangePercent } : {}),
        ...(p95TraceContributionPercent !== undefined ? { p95TraceContributionPercent } : {}),
        ...(p99TraceContributionPercent !== undefined ? { p99TraceContributionPercent } : {}),
        regressionDetected,
        confidence,
        evidenceReasons: reasons,
      },
      identity,
      query: queryFor(first),
      ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
      ...(first.dbOperationName ? { queryOperation: first.dbOperationName } : {}),
      ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
      ...(first.dbCollectionName ? { collectionName: first.dbCollectionName } : {}),
      ...(first.endpoint ? { endpoint: first.endpoint } : {}),
      ...(payloadValues.length >= MINIMUM_SAMPLES ? { payloadBytes: distribution(payloadValues) } : {}),
      samples: group.slice(0, 20),
      recommendation: recommendationFor(currentRows.p95, currentRows.p99, largeResultRate, regressionDetected, traceContributionDetected),
    });
  }

  return {
    candidates: candidates.sort((a, b) => b.signal.p99ReturnedRows - a.signal.p99ReturnedRows).slice(0, 100),
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

function distribution(values: number[]): DatabaseResultSetDistribution {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function distributionPair(samples: DatabaseResultSetTrace[]): { rows: DatabaseResultSetDistribution; duration: DatabaseResultSetDistribution } {
  return {
    rows: distribution(samples.map((sample) => sample.returnedRows ?? 0)),
    duration: distribution(samples.map((sample) => sample.duration)),
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

function percentileTraceContribution(samples: DatabaseResultSetTrace[], quantile: number): number | undefined {
  const contributions = samples
    .filter((sample) => sample.traceDuration !== undefined && sample.traceDuration > 0)
    .map((sample) => Math.min(100, (sample.duration / sample.traceDuration!) * 100));
  return contributions.length >= MINIMUM_SAMPLES ? percentile(contributions, quantile) : undefined;
}

function percentChange(current: number, baseline: number | undefined): number | undefined {
  if (baseline === undefined || baseline <= 0) return undefined;
  return ((current - baseline) / baseline) * 100;
}

function recommendationFor(
  p95Rows: number,
  p99Rows: number,
  largeResultRate: number,
  regression: boolean,
  traceContributionDetected: boolean,
): DatabaseResultSetCandidate['recommendation'] {
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
  if (traceContributionDetected) {
    return {
      action: 'bounded-query',
      guidance: 'Database time is materially contributing to request latency. Reduce unnecessary result transfer first, then validate the query plan and endpoint behavior.',
      validation: 'Compare DB duration contribution, endpoint p50/p95/p99 latency, returned rows, and payload size before and after the change.',
    };
  }
  if (regression) {
    return {
      action: 'benchmark',
      guidance: 'Treat this as a regression candidate. Compare the current query shape with the baseline before changing indexes or query structure.',
      validation: 'Run a controlled benchmark and compare current and baseline p50/p95/p99 distributions, DB contribution, and request latency.',
    };
  }
  return {
    action: 'inspect-payload',
    guidance: 'Inspect result-set size and payload characteristics before changing the database access path.',
    validation: 'Confirm that any change reduces the measured result-set or payload cost without changing required response semantics.',
  };
}
