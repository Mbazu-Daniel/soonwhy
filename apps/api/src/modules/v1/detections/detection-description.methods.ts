export function describeDatabaseResultSet(candidate: {
  signal: { p95ReturnedRows: number; p99ReturnedRows: number; largeResultRows: number; regressionDetected: boolean; sampleCount: number; querySummary?: string; queryOperation?: string; query: string; endpoint?: string; p95RowsChangePercent?: number; p95TraceContributionPercent?: number };
  querySummary?: string;
  queryOperation?: string;
  query: string;
  endpoint?: string;
}): string {
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

export function describeDatabaseBatch(candidate: {
  signal: { p95DurationChangePercent?: number; p99DurationChangePercent?: number; p95TraceContributionPercent?: number; sampleCount: number; querySummary?: string; queryOperation?: string; query: string; logicalOperationCount: number; averageBatchSize: number; p50BatchSize: number; p95BatchSize: number; p99BatchSize: number; p50Duration: number; p95Duration: number; p99Duration: number; baselineSampleCount?: number; p95BatchSizeChangePercent?: number; p99BatchSizeChangePercent?: number; fingerprint?: string; databaseSystem?: string; dependencyName?: string; collectionName?: string; dbQueryText?: string; dbBatchSize?: number; dbQuerySummary?: string; dbSystemName?: string; dbCollectionName?: string; httpRoute?: string; endpoint?: string; batchOperationCount?: number; degradationSignals: string[]; confidence: string; recommendation: string }
  querySummary?: string;
  queryOperation?: string;
  query: string;
  endpoint?: string;
}): string {
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

export function describeDatabaseTimeout(candidate: {
  signal: { timeoutCount: number; totalCount: number; timeoutRate: number; querySummary?: string; queryOperation?: string; query: string };
  querySummary?: string;
  queryOperation?: string;
  query: string;
}): string {
  const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
  return queryLabel + ' timed out ' + candidate.signal.timeoutCount + ' times out of ' + candidate.signal.totalCount + ' executions (' + (candidate.signal.timeoutRate * 100).toFixed(1) + '%).';
}

export function describeDatabaseError(candidate: {
  signal: { errorCount: number; totalCount: number; errorRate: number; querySummary?: string; queryOperation?: string; query: string };
  querySummary?: string;
  queryOperation?: string;
  query: string;
}): string {
  const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
  return queryLabel +
    ' failed ' + candidate.signal.errorCount +
    ' times out of ' + candidate.signal.totalCount +
    ' executions, for a ' +
    (candidate.signal.errorRate * 100).toFixed(1) +
    '% database error rate.';
}

export function describeDatabaseQueryVolume(candidate: {
  signal: { currentCount: number; baselineCount: number; relativeIncrease: number; querySummary?: string; queryOperation?: string; query: string };
  querySummary?: string;
  queryOperation?: string;
  query: string;
}): string {
  const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
  return queryLabel +
    ' ran ' + candidate.signal.currentCount +
    ' times in the current window versus ' +
    candidate.signal.baselineCount +
    ' in the previous comparable window, a ' +
    candidate.signal.relativeIncrease.toFixed(0) +
    '% increase.';
}

export function describeNPlusOne(candidate: {
  signal: { occurrences: number; totalDurationMs: number; querySummary?: string; queryOperation?: string; query: string };
  querySummary?: string;
  queryOperation?: string;
  query: string;
}): string {
  const queryLabel = candidate.querySummary ?? candidate.queryOperation ?? candidate.query;
  return queryLabel +
    ' was executed ' + candidate.signal.occurrences +
    ' times in one trace under the same parent span, consuming about ' +
    Math.round(candidate.signal.totalDurationMs) +
    'ms of database time.';
}

export function describePerformanceSignal(signal: {
  latency: { p50: number; p95: number; p99: number };
  reasons: string[];
}): string {
  if (!signal) return 'Service performance degraded over the last 15 minutes.';
  return signal.reasons.join('. ') + '. P50: ' +
    Math.round(signal.latency.p50) + 'ms, P95: ' +
    Math.round(signal.latency.p95) + 'ms, P99: ' +
    Math.round(signal.latency.p99) + 'ms.';
}

export function describeSignal(description: string, signal: {
  baselineValue?: number;
  changePercent?: number;
}): string {
  if (signal?.baselineValue === undefined || signal.changePercent === undefined) {
    return description;
  }
  return description + ' This is a ' + signal.changePercent.toFixed(0) + '% increase from the previous comparable window.';
}

export function describeThroughputSignal(signal: {
  baselineValue: number;
  observedValue: number;
  changePercent: number;
}): string {
  return 'Request throughput fell from an expected ' + Math.round(signal.baselineValue) +
    ' requests to ' + Math.round(signal.observedValue) + ' requests over the last 15 minutes (' + signal.changePercent.toFixed(0) + '%).';
}

// Stubs for functions imported by detection.service.ts that are not defined here.
export function describeDatabaseQuery(candidate: unknown): string {
  return '';
}

export function describeDatabaseLatencyContribution(candidate: unknown): string {
  return '';
}

export function describeDatabaseConnectionWait(candidate: unknown): string {
  return '';
}

export function assertProjectAccess(orgId: string, projectId: string): Promise<void> {
  return Promise.resolve();
}

export function createFindingFromError(orgId: string, projectId: string, input: { fingerprint: string; service?: string }): Promise<unknown> {
  return Promise.resolve(undefined);
}

export function describeDatabaseConnectionPool(candidate: unknown): string {
  return '';
}
