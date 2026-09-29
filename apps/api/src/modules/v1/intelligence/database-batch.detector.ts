import { fingerprintQuery } from './query-fingerprint';

export interface DatabaseBatchTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  traceDuration?: number;
  dependencyType: string;
  dependencyName: string;
  batchSize?: number;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  endpoint?: string;
}

export interface DatabaseBatchSignal {
  sampleCount: number;
  batchOperationCount: number;
  logicalOperationCount: number;
  averageBatchSize: number;
  p50BatchSize: number;
  p95BatchSize: number;
  p99BatchSize: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  p95BatchSizeChangePercent?: number;
  p99BatchSizeChangePercent?: number;
  p95DurationChangePercent?: number;
  p99DurationChangePercent?: number;
  p95TraceContributionPercent?: number;
  regressionDetected: boolean;
  traceContributionDetected: boolean;
  confidence: 'low' | 'medium' | 'high';
  evidenceReasons: string[];
}

export interface DatabaseBatchCandidate {
  serviceName: string;
  signal: DatabaseBatchSignal;
  identity: ReturnType<typeof fingerprintQuery>['identity'];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  endpoint?: string;
  samples: DatabaseBatchTrace[];
  recommendation: {
    action: 'benchmark' | 'review-batch-shape' | 'preserve-batching';
    guidance: string;
    validation: string;
  };
}

const MINIMUM_SAMPLES = 5;
const REGRESSION_BATCH_SIZE_PERCENT = 100;
const REGRESSION_DURATION_PERCENT = 50;
const TRACE_CONTRIBUTION_PERCENT = 50;

export function detectDatabaseBatches(
  samples: DatabaseBatchTrace[],
  baselineSamples: DatabaseBatchTrace[] = [],
): DatabaseBatchCandidate[] {
  const currentGroups = groupSamples(samples);
  const baselineGroups = groupSamples(baselineSamples);
  const candidates: DatabaseBatchCandidate[] = [];

  for (const [key, current] of currentGroups) {
    const first = current[0];
    if (!first || current.length < MINIMUM_SAMPLES) continue;

    const currentBatchSizes = current.map((sample) => sample.batchSize ?? 0);
    const currentDurations = current.map((sample) => sample.duration);
    const baseline = baselineGroups.get(key);
    const baselineBatch = baseline && baseline.length >= MINIMUM_SAMPLES
      ? distribution(baseline.map((sample) => sample.batchSize ?? 0))
      : undefined;
    const baselineDuration = baseline && baseline.length >= MINIMUM_SAMPLES
      ? distribution(baseline.map((sample) => sample.duration))
      : undefined;

    const currentBatch = distribution(currentBatchSizes);
    const currentDuration = distribution(currentDurations);
    const p95BatchSizeChangePercent = percentChange(currentBatch.p95, baselineBatch?.p95);
    const p99BatchSizeChangePercent = percentChange(currentBatch.p99, baselineBatch?.p99);
    const p95DurationChangePercent = percentChange(currentDuration.p95, baselineDuration?.p95);
    const p99DurationChangePercent = percentChange(currentDuration.p99, baselineDuration?.p99);
    const p95TraceContributionPercent = percentileTraceContribution(current, 0.95);

    const regressionDetected =
      (p95BatchSizeChangePercent !== undefined && p95BatchSizeChangePercent >= REGRESSION_BATCH_SIZE_PERCENT) ||
      (p99BatchSizeChangePercent !== undefined && p99BatchSizeChangePercent >= REGRESSION_BATCH_SIZE_PERCENT) ||
      (p95DurationChangePercent !== undefined && p95DurationChangePercent >= REGRESSION_DURATION_PERCENT) ||
      (p99DurationChangePercent !== undefined && p99DurationChangePercent >= REGRESSION_DURATION_PERCENT);
    const traceContributionDetected = (p95TraceContributionPercent ?? 0) >= TRACE_CONTRIBUTION_PERCENT;

    if (!regressionDetected && !traceContributionDetected) continue;

    const reasons: string[] = [];
    if (regressionDetected) reasons.push('batch_size_or_duration_regression');
    if (traceContributionDetected) reasons.push('database_time_is_material_to_trace_latency');
    if (baselineSamples.length > 0 && (!baseline || baseline.length < MINIMUM_SAMPLES)) reasons.push('baseline_insufficient');
    if (current.some((sample) => sample.endpoint)) reasons.push('endpoint_context_available');

    const confidence = regressionDetected && traceContributionDetected
      ? 'high'
      : regressionDetected || traceContributionDetected
        ? 'medium'
        : 'low';

    candidates.push({
      serviceName: first.service,
      signal: {
        sampleCount: current.length,
        batchOperationCount: current.length,
        logicalOperationCount: current.reduce((sum, sample) => sum + (sample.batchSize ?? 0), 0),
        averageBatchSize: current.reduce((sum, sample) => sum + (sample.batchSize ?? 0), 0) / current.length,
        p50BatchSize: currentBatch.p50,
        p95BatchSize: currentBatch.p95,
        p99BatchSize: currentBatch.p99,
        p50Duration: currentDuration.p50,
        p95Duration: currentDuration.p95,
        p99Duration: currentDuration.p99,
        ...(p95BatchSizeChangePercent !== undefined ? { p95BatchSizeChangePercent } : {}),
        ...(p99BatchSizeChangePercent !== undefined ? { p99BatchSizeChangePercent } : {}),
        ...(p95DurationChangePercent !== undefined ? { p95DurationChangePercent } : {}),
        ...(p99DurationChangePercent !== undefined ? { p99DurationChangePercent } : {}),
        ...(p95TraceContributionPercent !== undefined ? { p95TraceContributionPercent } : {}),
        regressionDetected,
        traceContributionDetected,
        confidence,
        evidenceReasons: reasons,
      },
      identity: fingerprintQuery(queryFor(first), first.dbSystemName).identity,
      query: queryFor(first),
      ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
      ...(first.dbOperationName ? { queryOperation: first.dbOperationName } : {}),
      ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
      ...(first.dbCollectionName ? { collectionName: first.dbCollectionName } : {}),
      ...(first.endpoint ? { endpoint: first.endpoint } : {}),
      samples: current.slice(0, 20),
      recommendation: recommendationFor(regressionDetected, traceContributionDetected),
    });
  }

  return candidates
    .sort((left, right) => right.signal.p95Duration - left.signal.p95Duration)
    .slice(0, 100);
}

function groupSamples(samples: DatabaseBatchTrace[]): Map<string, DatabaseBatchTrace[]> {
  const groups = new Map<string, DatabaseBatchTrace[]>();

  for (const sample of samples) {
    if (
      sample.dependencyType !== 'database' ||
      !sample.service ||
      sample.batchSize === undefined ||
      !Number.isInteger(sample.batchSize) ||
      sample.batchSize < 2 ||
      !Number.isFinite(sample.duration) ||
      sample.duration <= 0
    ) continue;

    const identity = fingerprintQuery(queryFor(sample), sample.dbSystemName).identity;
    const key = [
      sample.service,
      identity.fingerprint,
      identity.fingerprintVersion,
      sample.dbSystemName ?? '',
    ].join('\\0');
    const existing = groups.get(key) ?? [];
    existing.push(sample);
    groups.set(key, existing);
  }

  return groups;
}

function queryFor(sample: DatabaseBatchTrace): string {
  return sample.dbQueryText ?? sample.dbQuerySummary ?? sample.dbOperationName ?? sample.dependencyName;
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

function percentileTraceContribution(samples: DatabaseBatchTrace[], quantile: number): number | undefined {
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
  regressionDetected: boolean,
  traceContributionDetected: boolean,
): DatabaseBatchCandidate['recommendation'] {
  if (regressionDetected) {
    return {
      action: 'benchmark',
      guidance: 'Compare the current batch shape with the previous comparable window before changing query or batching strategy. Inspect whether larger batches or slower execution explain the regression.',
      validation: 'Compare batch size distribution, database duration, logical operations represented, and endpoint latency before and after the change.',
    };
  }

  if (traceContributionDetected) {
    return {
      action: 'review-batch-shape',
      guidance: 'Database batch work is materially contributing to trace latency. Inspect batch size, query shape, returned work, and whether the batch can be reduced or moved off the request critical path.',
      validation: 'Compare DB contribution, batch size distribution, database duration, and endpoint p50/p95/p99 latency before and after the change.',
    };
  }

  return {
    action: 'preserve-batching',
    guidance: 'Batch telemetry is present but there is no evidence here of a regression or material trace contribution. Preserve the batching behavior until stronger evidence appears.',
    validation: 'Continue comparing batch size and database duration across comparable windows.',
  };
}
