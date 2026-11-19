import { evaluateLatency as evaluatePerformanceLatency } from "../../intelligence/domain/performance.engine";
import type { DetectionSignalType, DetectionBaseline, DetectionSignal, ThroughputThresholds } from "./detection.engine.types";
import { DETECTION_RULES } from "./detection.engine.constants";

const MIN_BASELINE_SAMPLES = 20;

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

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
  thresholds: ThroughputThresholds = {},
): DetectionSignal | undefined {
  const minBaselineSamples = finite(thresholds.minBaselineSamples, MIN_BASELINE_SAMPLES);
  const dropRatio = finite(thresholds.dropRatio, 0.7);
  const criticalChangePercent = finite(thresholds.criticalChangePercent, -50);
  if (!Number.isFinite(observedValue) || !baseline || baseline.samples < minBaselineSamples || baseline.value <= 0) {
    return undefined;
  }
  const changePercent = baseline.value > 0 ? (observedValue - baseline.value) / baseline.value * 100 : 0;
  const threshold = baseline.value * dropRatio;
  if (observedValue <= threshold) {
    return {
      type: "throughput",
      observedValue,
      threshold,
      severity: changePercent <= criticalChangePercent ? "critical" : "warning",
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
