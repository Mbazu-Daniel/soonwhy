type QueryCandidate = {
  signal?: Record<string, unknown>;
  querySummary?: string;
  queryOperation?: string;
  query?: string;
  endpoint?: string;
};

function queryLabel(candidate: QueryCandidate): string {
  return String(
    candidate.querySummary ??
      candidate.queryOperation ??
      candidate.query ??
      candidate.signal?.querySummary ??
      candidate.signal?.queryOperation ??
      candidate.signal?.query ??
      'database query',
  );
}

export function describeDatabaseResultSet(candidate: any): string {
  const endpoint = candidate.endpoint ? ' on ' + candidate.endpoint : '';
  const regression = candidate.signal?.regressionDetected && candidate.signal?.p95RowsChangePercent !== undefined
    ? ' P95 returned rows increased by ' + Number(candidate.signal.p95RowsChangePercent).toFixed(0) + '% from the comparable baseline.'
    : '';
  const contribution = candidate.signal?.p95TraceContributionPercent !== undefined
    ? ' Database time contributes ' + Number(candidate.signal.p95TraceContributionPercent).toFixed(0) + '% of trace duration at p95.'
    : '';
  return queryLabel(candidate) + endpoint + ' returns ' +
    Math.round(Number(candidate.signal?.p95ReturnedRows ?? 0)) + ' rows at p95 and ' +
    Math.round(Number(candidate.signal?.p99ReturnedRows ?? 0)) + ' at p99 across ' +
    Number(candidate.signal?.sampleCount ?? 0) + ' executions.' + regression + contribution;
}

export function describeDatabaseBatch(candidate: any): string {
  const regression = candidate.signal?.p95DurationChangePercent !== undefined
    ? ' P95 database duration changed by ' + Number(candidate.signal.p95DurationChangePercent).toFixed(0) + '% from baseline.'
    : '';
  const contribution = candidate.signal?.p95TraceContributionPercent !== undefined
    ? ' P95 database contribution is ' + Number(candidate.signal.p95TraceContributionPercent).toFixed(0) + '% of trace duration.'
    : '';
  return queryLabel(candidate) +
    ' ran as a batch across ' + Number(candidate.signal?.sampleCount ?? 0) + ' executions with an average batch size of ' +
    Number(candidate.signal?.averageBatchSize ?? 0).toFixed(1) + ' (' + Number(candidate.signal?.logicalOperationCount ?? 0) + ' logical operations).' +
    regression + contribution;
}

export function describeDatabaseTimeout(candidate: any): string {
  const timeoutRate = Number(candidate.signal?.timeoutRate ?? 0);
  return queryLabel(candidate) + ' timed out ' + Number(candidate.signal?.timeoutCount ?? 0) + ' times out of ' + Number(candidate.signal?.totalCount ?? 0) + ' executions (' + (timeoutRate * 100).toFixed(1) + '%).';
}

export function describeDatabaseError(candidate: any): string {
  const errorRate = Number(candidate.signal?.errorRate ?? 0);
  return queryLabel(candidate) +
    ' failed ' + Number(candidate.signal?.errorCount ?? 0) +
    ' times out of ' + Number(candidate.signal?.totalCount ?? 0) +
    ' executions, for a ' +
    (errorRate * 100).toFixed(1) +
    '% database error rate.';
}

export function describeDatabaseQueryVolume(candidate: any): string {
  return queryLabel(candidate) +
    ' ran ' + Number(candidate.signal?.currentCount ?? 0) +
    ' times in the current window versus ' +
    Number(candidate.signal?.baselineCount ?? 0) +
    ' in the previous comparable window, a ' +
    Number(candidate.signal?.relativeIncrease ?? 0).toFixed(0) +
    '% increase.';
}

export function describeNPlusOne(candidate: any): string {
  return queryLabel(candidate) +
    ' was executed ' + Number(candidate.signal?.occurrences ?? 0) +
    ' times in one trace under the same parent span, consuming about ' +
    Math.round(Number(candidate.signal?.totalDurationMs ?? 0)) +
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

export function describeDatabaseQuery(candidate: any): string {
  const distribution = candidate.signal?.distribution;
  const p95 = Number(candidate.signal?.observedValue ?? distribution?.p95 ?? 0);
  const threshold = Number(candidate.signal?.threshold ?? 0);
  const samples = Number(distribution?.sampleCount ?? 0);
  const regression = candidate.signal?.changePercent !== undefined
    ? ' This is a ' + Number(candidate.signal.changePercent).toFixed(0) + '% increase from the previous comparable window.'
    : '';
  return queryLabel(candidate) + ' ran at p95 ' + Math.round(p95) + 'ms across ' + samples +
    ' executions (threshold ' + Math.round(threshold) + 'ms).' + regression;
}

export function describeDatabaseLatencyContribution(candidate: any): string {
  const sampleCount = Number(candidate.signal?.sampleCount ?? 0);
  const p50 = Number(candidate.signal?.p50ContributionPercent ?? 0);
  const p95 = Number(candidate.signal?.p95ContributionPercent ?? 0);
  const p95Duration = Number(candidate.signal?.p95DurationMs ?? 0);
  return queryLabel(candidate) + ' accounts for ' + p95.toFixed(0) +
    '% of p95 trace duration (p50 ' + p50.toFixed(0) + '%) across ' + sampleCount +
    ' traces, consuming ' + Math.round(p95Duration) + 'ms of database time at p95.';
}

export function describeDatabaseConnectionWait(candidate: any): string {
  const pool = candidate.poolName ? ' for pool ' + candidate.poolName : '';
  const severity = candidate.signal?.severity ? ' (' + candidate.signal.severity + ')' : '';
  const regression = candidate.signal?.p95ChangePercent !== undefined
    ? ' This is a ' + Number(candidate.signal.p95ChangePercent).toFixed(0) +
      '% increase from the baseline p95 of ' +
      Math.round(Number(candidate.signal?.baselineP95WaitMs ?? 0)) + 'ms.'
    : '';
  return 'Connections waited' + pool + ' in ' + candidate.serviceName + ': p95 ' +
    Math.round(Number(candidate.signal?.p95WaitMs ?? 0)) + 'ms (p50 ' +
    Math.round(Number(candidate.signal?.p50WaitMs ?? 0)) + 'ms, p99 ' +
    Math.round(Number(candidate.signal?.p99WaitMs ?? 0)) + 'ms) across ' +
    Number(candidate.signal?.sampleCount ?? 0) + ' samples' + severity + '.' + regression;
}

export function describeDatabaseConnectionPool(candidate: any): string {
  const pool = candidate.poolName ? ' ' + candidate.poolName : '';
  const parts: string[] = [];
  const utilization = candidate.signal?.p95UtilizationPercent;
  if (utilization !== undefined) {
    parts.push('p95 utilization ' + Number(utilization).toFixed(0) + '%');
  }
  const pending = candidate.signal?.p95PendingRequests;
  if (pending !== undefined) {
    parts.push('p95 pending requests ' + Number(pending).toFixed(0));
  }
  const timeoutIncrease = candidate.signal?.timeoutIncrease;
  if (timeoutIncrease !== undefined && timeoutIncrease > 0) {
    parts.push('timeouts increased by ' + Number(timeoutIncrease).toFixed(0));
  }
  const detail = parts.length ? parts.join(', ') : 'elevated pressure';
  return 'Connection pool' + pool + ' in ' + candidate.serviceName + ' shows ' + detail +
    ' across ' + Number(candidate.signal?.sampleCount ?? 0) + ' samples.';
}
