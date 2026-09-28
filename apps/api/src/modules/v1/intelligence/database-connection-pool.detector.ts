export interface DatabaseConnectionPoolSample {
  timestamp: string;
  service: string;
  poolName: string;
  usedConnections?: number;
  maxConnections?: number;
  pendingRequests?: number;
  connectionTimeouts?: number;
}

export interface DatabaseConnectionPoolThresholds {
  minimumSamples: number;
  minimumUtilization: number;
  minimumPendingRequests: number;
  minimumTimeouts: number;
}

export interface DatabaseConnectionPoolSignal {
  sampleCount: number;
  p95UtilizationPercent?: number;
  p95PendingRequests?: number;
  timeoutIncrease?: number;
}

export interface DatabaseConnectionPoolCandidate {
  serviceName: string;
  poolName: string;
  signal: DatabaseConnectionPoolSignal;
  samples: DatabaseConnectionPoolSample[];
}

export const DEFAULT_DATABASE_CONNECTION_POOL_THRESHOLDS: DatabaseConnectionPoolThresholds = {
  minimumSamples: 5,
  minimumUtilization: 80,
  minimumPendingRequests: 1,
  minimumTimeouts: 1,
};

export function detectDatabaseConnectionPool(
  samples: DatabaseConnectionPoolSample[],
  thresholds: DatabaseConnectionPoolThresholds = DEFAULT_DATABASE_CONNECTION_POOL_THRESHOLDS,
): DatabaseConnectionPoolCandidate[] {
  const groups = new Map<string, DatabaseConnectionPoolSample[]>();

  for (const sample of samples) {
    if (!sample.service || !sample.poolName || !Number.isFinite(Date.parse(sample.timestamp))) continue;
    const key = sample.service + '\0' + sample.poolName;
    const existing = groups.get(key) ?? [];
    existing.push(sample);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).flatMap((poolSamples) => {
    const first = poolSamples[0];
    if (!first || poolSamples.length < thresholds.minimumSamples) return [];

    const utilization = poolSamples
      .filter((sample) =>
        sample.usedConnections !== undefined &&
        sample.maxConnections !== undefined &&
        sample.maxConnections > 0 &&
        sample.usedConnections >= 0,
      )
      .map((sample) => Math.min(100, (sample.usedConnections! / sample.maxConnections!) * 100));

    const pending = poolSamples
      .filter((sample) => sample.pendingRequests !== undefined && sample.pendingRequests >= 0)
      .map((sample) => sample.pendingRequests!);

    const timeoutSamples = poolSamples
      .filter((sample) => sample.connectionTimeouts !== undefined && sample.connectionTimeouts >= 0)
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

    const p95UtilizationPercent = utilization.length ? percentile(utilization, 95) : undefined;
    const p95PendingRequests = pending.length ? percentile(pending, 95) : undefined;
    const timeoutIncrease = timeoutSamples.length >= 2
      ? Math.max(0, (timeoutSamples.at(-1)?.connectionTimeouts ?? 0) - (timeoutSamples[0]?.connectionTimeouts ?? 0))
      : undefined;

    if (
      (p95UtilizationPercent ?? 0) < thresholds.minimumUtilization &&
      (p95PendingRequests ?? 0) < thresholds.minimumPendingRequests &&
      (timeoutIncrease ?? 0) < thresholds.minimumTimeouts
    ) return [];

    return [{
      serviceName: first.service,
      poolName: first.poolName,
      signal: {
        sampleCount: poolSamples.length,
        ...(p95UtilizationPercent !== undefined ? { p95UtilizationPercent } : {}),
        ...(p95PendingRequests !== undefined ? { p95PendingRequests } : {}),
        ...(timeoutIncrease !== undefined ? { timeoutIncrease } : {}),
      },
      samples: poolSamples.slice(-10),
    }];
  }).sort((left, right) =>
    (right.signal.p95PendingRequests ?? right.signal.p95UtilizationPercent ?? 0) -
    (left.signal.p95PendingRequests ?? left.signal.p95UtilizationPercent ?? 0),
  ).slice(0, 100);
}

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const position = (percentileValue / 100) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower] ?? 0;
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}
