export type DetectionSignalType = 'latency' | 'error_rate';

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
