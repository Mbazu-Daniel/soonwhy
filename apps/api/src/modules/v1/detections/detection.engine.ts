import {
  evaluateLatency as evaluatePerformanceLatency,
  evaluateThroughput as evaluatePerformanceThroughput,
  evaluateTraceContribution,
} from "../intelligence/performance.engine";
import {
  basicSeasonalDecomposition,
  calculateAnomalyScore,
  calculateSeasonalIndex,
} from "./intelligence/seasonal-decomposition";
import {
  detectChangePoints,
  detectChangePointsBIC,
} from "./intelligence/change-point-detection";

export type DetectionSignalType =
  | "latency"
  | "error_rate"
  | "dependency_latency"
  | "trace_span"
  | "throughput"
  | "seasonal_anomaly"
  | "change_point";

export interface DetectionRule {
  type: DetectionSignalType;
  threshold: number;
  criticalMultiplier: number;
  regressionRelativeIncrease: number;
  regressionAbsoluteIncrease: number;
  criticalRegressionRelativeIncrease: number;
  period?: number;
  unit: "ms" | "%" | "z-score" | "count" | "requests";
}

export interface DetectionBaseline {
  value: number;
  samples: number;
}

export interface DetectionSignal {
  type: DetectionSignalType;
  observedValue: number;
  threshold: number;
  severity: "warning" | "critical";
  unit: "ms" | "%" | "z-score" | "count" | "requests";
  baselineValue?: number;
  changePercent?: number;
  anomalyScore?: number;
  seasonalIndex?: number;
  changePointIndex?: number;
}

export const DETECTION_RULES: Record<DetectionSignalType, DetectionRule> = {
  latency: {
    type: "latency",
    threshold: 1_000,
    criticalMultiplier: 2,
    regressionRelativeIncrease: 0.5,
    regressionAbsoluteIncrease: 250,
    criticalRegressionRelativeIncrease: 1,
    unit: "ms",
  },
  error_rate: {
    type: "error_rate",
    threshold: 5,
    criticalMultiplier: 2,
    regressionRelativeIncrease: 1,
    regressionAbsoluteIncrease: 2,
    criticalRegressionRelativeIncrease: 2,
    unit: "%",
  },
  dependency_latency: {
    type: "dependency_latency",
    threshold: 500,
    criticalMultiplier: 2,
    regressionRelativeIncrease: 0.5,
    regressionAbsoluteIncrease: 250,
    criticalRegressionRelativeIncrease: 1,
    unit: "ms",
  },
  trace_span: {
    type: "trace_span",
    threshold: 50,
    criticalMultiplier: 1.5,
    regressionRelativeIncrease: 0,
    regressionAbsoluteIncrease: 0,
    criticalRegressionRelativeIncrease: 0.75,
    unit: "%",
  },
  seasonal_anomaly: {
    type: "seasonal_anomaly",
    threshold: 2,
    criticalMultiplier: 2,
    regressionRelativeIncrease: 0,
    regressionAbsoluteIncrease: 0,
    criticalRegressionRelativeIncrease: 0,
    unit: "z-score",
  },
  change_point: {
    type: "change_point",
    threshold: 1,
    criticalMultiplier: 3,
    regressionRelativeIncrease: 0,
    regressionAbsoluteIncrease: 0,
    criticalRegressionRelativeIncrease: 0,
    unit: "count",
  },
  throughput: {
    type: "throughput",
    threshold: 70,
    criticalMultiplier: 2,
    regressionRelativeIncrease: 0.3,
    regressionAbsoluteIncrease: 10,
    criticalRegressionRelativeIncrease: 0.5,
    unit: "requests",
  },
};

const MIN_BASELINE_SAMPLES = 20;

export function evaluateSignal(
  type: DetectionSignalType,
  observedValue: number,
  baseline?: DetectionBaseline,
): DetectionSignal | undefined {
  const rule = DETECTION_RULES[type];

  if (!Number.isFinite(observedValue)) {
    return undefined;
  }

  if (type === "latency" || type === "dependency_latency") {
    const thresholdBreach = observedValue >= rule.threshold;
    const hasBaseline =
      baseline !== undefined && baseline.samples >= MIN_BASELINE_SAMPLES;
    const performanceSignal = hasBaseline
      ? evaluatePerformanceLatency(observedValue, baseline)
      : undefined;

    if (!thresholdBreach && !performanceSignal) {
      return undefined;
    }

    return {
      type,
      observedValue,
      threshold: rule.threshold,
      severity:
        thresholdBreach &&
        observedValue >= rule.threshold * rule.criticalMultiplier
          ? "critical"
          : performanceSignal?.severity === "critical"
            ? "critical"
            : "warning",
      unit: rule.unit,
      ...(performanceSignal?.baselineValue !== undefined
        ? {
            baselineValue: performanceSignal.baselineValue,
            changePercent: performanceSignal.changePercent,
          }
        : {}),
    };
  }

  if (type === "error_rate") {
    const thresholdBreach = observedValue >= rule.threshold;
    const hasBaseline =
      baseline !== undefined && baseline.samples >= MIN_BASELINE_SAMPLES;
    const absoluteIncrease = hasBaseline ? observedValue - baseline.value : 0;
    const relativeIncrease =
      hasBaseline && baseline.value > 0
        ? absoluteIncrease / baseline.value
        : hasBaseline && observedValue > 0
          ? Number.POSITIVE_INFINITY
          : 0;
    const regression =
      hasBaseline &&
      absoluteIncrease >= rule.regressionAbsoluteIncrease &&
      relativeIncrease >= rule.regressionRelativeIncrease;

    if (!thresholdBreach && !regression) {
      return undefined;
    }

    return {
      type,
      observedValue,
      threshold: rule.threshold,
      severity:
        observedValue >= rule.threshold * rule.criticalMultiplier ||
        relativeIncrease >= rule.criticalRegressionRelativeIncrease
          ? "critical"
          : "warning",
      unit: rule.unit,
      ...(hasBaseline
        ? {
            baselineValue: baseline.value,
            changePercent: Number.isFinite(relativeIncrease)
              ? relativeIncrease * 100
              : undefined,
          }
        : {}),
    };
  }

  if (type === "seasonal_anomaly") {
    const isCritical = Math.abs(observedValue) >= (rule.threshold || 2);
    const severity: "warning" | "critical" = isCritical
      ? "critical"
      : "warning";

    return {
      type,
      observedValue,
      threshold: rule.threshold || 2,
      severity,
      unit: "z-score",
    };
  }

  if (type === "change_point") {
    const changePointCount = observedValue;
    const isCritical = changePointCount >= (rule.criticalMultiplier || 3);
    const severity: "warning" | "critical" = isCritical
      ? "critical"
      : "warning";

    return {
      type,
      observedValue: changePointCount,
      threshold: rule.threshold || 1,
      severity,
      unit: "count",
    };
  }

  return undefined;
}

export function evaluateThroughput(
  observedValue: number,
  baseline?: DetectionBaseline,
): DetectionSignal | undefined {
  if (!Number.isFinite(observedValue) || !baseline || baseline.samples < 20) {
    return undefined;
  }
  const changePercent = baseline.value > 0 ? (observedValue - baseline.value) / baseline.value * 100 : 0;
  const threshold = baseline.value * 0.7;
  if (observedValue < threshold) {
    return {
      type: "throughput",
      observedValue,
      threshold,
      severity: changePercent <= -50 ? "critical" : "warning",
      unit: "requests",
      baselineValue: baseline.value,
      changePercent,
    };
  }
  return undefined;
}

export function evaluateTraceSpan(
  spanDuration: number,
  traceDuration: number,
): DetectionSignal | undefined {
  if (!Number.isFinite(spanDuration) || !Number.isFinite(traceDuration) || traceDuration <= 0) {
    return undefined;
  }
  const observedValue = (spanDuration / traceDuration) * 100;
  if (observedValue >= 50) {
    return {
      type: "trace_span",
      observedValue,
      threshold: 50,
      severity: observedValue >= 75 ? "critical" : "warning",
      unit: "%",
    };
  }
  return undefined;
}
