import { percentile } from './percentile';
export type DatabaseQuerySeverity = "warning" | "critical";


export interface DatabaseQueryDistribution {
  p50: number;
  p95: number;
  p99: number;
  sampleCount: number;
}

export interface DatabaseQuerySignal {
  severity: DatabaseQuerySeverity;
  observedValue: number;
  threshold: number;
  baselineValue?: number;
  changePercent?: number;
  distribution: DatabaseQueryDistribution;
}

export interface DatabaseQueryThresholds {
  warningMs: number;
  criticalMs: number;
  minimumBaselineSamples: number;
  regressionAbsoluteMs: number;
  regressionRelative: number;
  criticalRegressionRelative: number;
}

const DEFAULT_DATABASE_QUERY_THRESHOLDS: DatabaseQueryThresholds = {
  warningMs: 500,
  criticalMs: 1_000,
  minimumBaselineSamples: 20,
  regressionAbsoluteMs: 250,
  regressionRelative: 0.5,
  criticalRegressionRelative: 1,
};

export function evaluateDatabaseQuery(
  observedP95Ms: number,
  baselineP95Ms: number | undefined,
  baselineSamples: number,
  thresholds: DatabaseQueryThresholds = DEFAULT_DATABASE_QUERY_THRESHOLDS,
  distribution: DatabaseQueryDistribution = {
    p50: observedP95Ms,
    p95: observedP95Ms,
    p99: observedP95Ms,
    sampleCount: 1,
  },
): DatabaseQuerySignal | undefined {
  if (!Number.isFinite(observedP95Ms) || observedP95Ms <= 0) return undefined;

  const thresholdBreach = observedP95Ms >= thresholds.warningMs;
  const criticalThresholdBreach = observedP95Ms >= thresholds.criticalMs;

  if (thresholdBreach) {
    return {
      severity: criticalThresholdBreach ? "critical" : "warning",
      observedValue: observedP95Ms,
      threshold: criticalThresholdBreach
        ? thresholds.criticalMs
        : thresholds.warningMs,
      ...(baselineP95Ms !== undefined &&
      baselineSamples >= thresholds.minimumBaselineSamples
        ? {
            baselineValue: baselineP95Ms,
            changePercent: percentChange(observedP95Ms, baselineP95Ms),
          }
        : {}),
      distribution,
    };
  }

  if (
    baselineP95Ms === undefined ||
    !Number.isFinite(baselineP95Ms) ||
    baselineP95Ms <= 0 ||
    baselineSamples < thresholds.minimumBaselineSamples
  ) {
    return undefined;
  }

  const absoluteIncrease = observedP95Ms - baselineP95Ms;
  const relativeIncrease = absoluteIncrease / baselineP95Ms;

  if (
    absoluteIncrease < thresholds.regressionAbsoluteMs ||
    relativeIncrease < thresholds.regressionRelative
  ) {
    return undefined;
  }

  return {
    severity:
      relativeIncrease >= thresholds.criticalRegressionRelative
        ? "critical"
        : "warning",
    observedValue: observedP95Ms,
    threshold: thresholds.warningMs,
    baselineValue: baselineP95Ms,
    changePercent: relativeIncrease * 100,
    distribution,
  };
}


function percentChange(value: number, baseline: number): number | undefined {
  if (baseline <= 0) return undefined;
  return ((value - baseline) / baseline) * 100;
}
