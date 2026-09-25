export type DetectionSignalType = 'latency' | 'error_rate' | 'dependency_latency' | 'trace_span';

export interface DetectionRule {
  type: DetectionSignalType;
  threshold: number;
  criticalMultiplier: number;
  regressionRelativeIncrease: number;
  regressionAbsoluteIncrease: number;
  criticalRegressionRelativeIncrease: number;
  unit: 'ms' | '%';
}

export interface DetectionBaseline {
  value: number;
  samples: number;
}

export interface DetectionSignal {
  type: DetectionSignalType;
  observedValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  unit: 'ms' | '%';
  baselineValue?: number;
  changePercent?: number;
}

export const DETECTION_RULES: Record<DetectionSignalType, DetectionRule> = {
  latency: {
    type: 'latency',
    threshold: 1_000,
    criticalMultiplier: 2,
    regressionRelativeIncrease: 0.5,
    regressionAbsoluteIncrease: 250,
    criticalRegressionRelativeIncrease: 1,
    unit: 'ms',
  },
  error_rate: {
    type: 'error_rate',
    threshold: 5,
    criticalMultiplier: 2,
    regressionRelativeIncrease: 1,
    regressionAbsoluteIncrease: 2,
    criticalRegressionRelativeIncrease: 2,
    unit: '%',
  },
  dependency_latency: {
    type: 'dependency_latency',
    threshold: 500,
    criticalMultiplier: 2,
    regressionRelativeIncrease: 0.5,
    regressionAbsoluteIncrease: 250,
    criticalRegressionRelativeIncrease: 1,
    unit: 'ms',
  },
  trace_span: {
    type: 'trace_span',
    threshold: 50,
    criticalMultiplier: 1.5,
    regressionRelativeIncrease: 0,
    regressionAbsoluteIncrease: 0,
    criticalRegressionRelativeIncrease: 0.75,
    unit: '%',
  },
};

export function evaluateSignal(
  type: DetectionSignalType,
  observedValue: number,
  baseline?: DetectionBaseline,
): DetectionSignal | undefined {
  const rule = DETECTION_RULES[type];

  if (!Number.isFinite(observedValue)) {
    return undefined;
  }

  const thresholdBreach = observedValue >= rule.threshold;
  const hasBaseline = baseline !== undefined && baseline.samples >= 20;
  const absoluteIncrease = hasBaseline
    ? observedValue - baseline.value
    : 0;
  const relativeIncrease =
    hasBaseline && baseline.value > 0
      ? absoluteIncrease / baseline.value
      : hasBaseline
        ? observedValue > 0
          ? Number.POSITIVE_INFINITY
          : 0
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
        ? 'critical'
        : 'warning',
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

export type ThroughputSeverity = 'warning' | 'critical';

export interface ThroughputSignal {
  type: 'throughput';
  observedValue: number;
  threshold: number;
  severity: ThroughputSeverity;
  unit: 'requests';
  baselineValue: number;
  changePercent: number;
}

const THROUGHPUT_WARNING_DECREASE = 0.3;
const THROUGHPUT_CRITICAL_DECREASE = 0.5;
const MIN_BASELINE_SAMPLES = 20;

export function evaluateThroughput(
  observedRequests: number,
  baseline?: DetectionBaseline,
): ThroughputSignal | undefined {
  if (
    !Number.isFinite(observedRequests) ||
    observedRequests < 0 ||
    baseline === undefined ||
    baseline.samples < MIN_BASELINE_SAMPLES ||
    !Number.isFinite(baseline.value) ||
    baseline.value <= 0
  ) {
    return undefined;
  }

  const changeRatio = (observedRequests - baseline.value) / baseline.value;
  const decrease = -changeRatio;

  if (decrease < THROUGHPUT_WARNING_DECREASE) {
    return undefined;
  }

  return {
    type: 'throughput',
    observedValue: observedRequests,
    threshold: baseline.value * (1 - THROUGHPUT_WARNING_DECREASE),
    severity: decrease >= THROUGHPUT_CRITICAL_DECREASE ? 'critical' : 'warning',
    unit: 'requests',
    baselineValue: baseline.value,
    changePercent: changeRatio * 100,
  };
}


export interface TraceSpanSignal {
  type: 'trace_span';
  observedValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  unit: '%';
  spanDuration: number;
  traceDuration: number;
}

export function evaluateTraceSpan(
  spanDuration: number,
  traceDuration: number,
): TraceSpanSignal | undefined {
  if (
    !Number.isFinite(spanDuration) ||
    !Number.isFinite(traceDuration) ||
    spanDuration <= 0 ||
    traceDuration <= 0 ||
    spanDuration > traceDuration
  ) {
    return undefined;
  }

  const contribution = (spanDuration / traceDuration) * 100;
  if (contribution < 50) return undefined;

  return {
    type: 'trace_span',
    observedValue: contribution,
    threshold: 50,
    severity: contribution >= 75 ? 'critical' : 'warning',
    unit: '%',
    spanDuration,
    traceDuration,
  };
}
