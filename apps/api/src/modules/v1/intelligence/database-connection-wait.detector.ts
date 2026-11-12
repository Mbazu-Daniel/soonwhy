import { percentile } from './percentile';
export interface DatabaseConnectionWaitSample {
  timestamp: string;
  service: string;
  poolName: string;
  waitTimeMs: number;
}

export interface DatabaseConnectionWaitThresholds {
  minimumSamples: number;
  warningP95WaitMs: number;
  criticalP95WaitMs: number;
  regressionPercent: number;
}

export interface DatabaseConnectionWaitSignal {
  sampleCount: number;
  severity: "warning" | "critical";
  p50WaitMs: number;
  p95WaitMs: number;
  p99WaitMs: number;
  baselineP95WaitMs?: number;
  p95ChangePercent?: number;
  regressionDetected: boolean;
}

export interface DatabaseConnectionWaitCandidate {
  serviceName: string;
  poolName: string;
  signal: DatabaseConnectionWaitSignal;
  samples: DatabaseConnectionWaitSample[];
}

const DEFAULT_DATABASE_CONNECTION_WAIT_THRESHOLDS: DatabaseConnectionWaitThresholds =
  {
    minimumSamples: 10,
    warningP95WaitMs: 50,
    criticalP95WaitMs: 200,
    regressionPercent: 100,
  };

export function detectDatabaseConnectionWait(
  samples: DatabaseConnectionWaitSample[],
  baselineSamples: DatabaseConnectionWaitSample[] = [],
  thresholds: DatabaseConnectionWaitThresholds = DEFAULT_DATABASE_CONNECTION_WAIT_THRESHOLDS,
): DatabaseConnectionWaitCandidate[] {
  const currentGroups = group(samples);
  const baselineGroups = group(baselineSamples);

  return Array.from(currentGroups.entries())
    .flatMap(([key, current]) => {
      const first = current[0];
      if (!first || current.length < thresholds.minimumSamples) return [];

      const currentValues = current.map((sample) => sample.waitTimeMs);
      const baseline = baselineGroups.get(key);
      const baselineP95 =
        baseline && baseline.length >= thresholds.minimumSamples
          ? percentile(baseline.map((sample) => sample.waitTimeMs), 0.95)
          : undefined;
      const p95WaitMs = percentile(currentValues, 0.95) ?? 0;
      const p95ChangePercent =
        baselineP95 !== undefined && baselineP95 > 0
          ? ((p95WaitMs - baselineP95) / baselineP95) * 100
          : undefined;
      const regressionDetected =
        p95ChangePercent !== undefined &&
        p95ChangePercent >= thresholds.regressionPercent;
      const pressureDetected = p95WaitMs >= thresholds.warningP95WaitMs;
      const critical =
        p95WaitMs >= thresholds.criticalP95WaitMs ||
        (p95ChangePercent !== undefined &&
          p95ChangePercent >= thresholds.regressionPercent * 2);

      if (!pressureDetected && !regressionDetected) return [];

      return [
        {
          serviceName: first.service,
          poolName: first.poolName,
          signal: {
            sampleCount: current.length,
            severity: (critical ? "critical" : "warning") as
              | "warning"
              | "critical",
            p50WaitMs: percentile(currentValues, 0.5) ?? 0,
            p95WaitMs,
            p99WaitMs: percentile(currentValues, 0.99) ?? 0,
            ...(baselineP95 !== undefined
              ? { baselineP95WaitMs: baselineP95 }
              : {}),
            ...(p95ChangePercent !== undefined ? { p95ChangePercent } : {}),
            regressionDetected,
          },
          samples: current.slice(-10),
        },
      ];
    })
    .sort((left, right) => right.signal.p95WaitMs - left.signal.p95WaitMs)
    .slice(0, 100);
}

function group(
  samples: DatabaseConnectionWaitSample[],
): Map<string, DatabaseConnectionWaitSample[]> {
  const groups = new Map<string, DatabaseConnectionWaitSample[]>();
  for (const sample of samples) {
    if (
      !sample.service ||
      !sample.poolName ||
      !Number.isFinite(Date.parse(sample.timestamp)) ||
      !Number.isFinite(sample.waitTimeMs) ||
      sample.waitTimeMs < 0
    )
      continue;

    const key = sample.service + "\\0" + sample.poolName;
    const existing = groups.get(key) ?? [];
    existing.push(sample);
    groups.set(key, existing);
  }
  return groups;
}

