export type DetectionSignalType = 'latency' | 'error_rate';

export interface DetectionRule {
  type: DetectionSignalType;
  threshold: number;
  criticalMultiplier: number;
  unit: 'ms' | '%';
}

export interface DetectionSignal {
  type: DetectionSignalType;
  observedValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  unit: 'ms' | '%';
}

export const DETECTION_RULES: Record<DetectionSignalType, DetectionRule> = {
  latency: {
    type: 'latency',
    threshold: 1_000,
    criticalMultiplier: 2,
    unit: 'ms',
  },
  error_rate: {
    type: 'error_rate',
    threshold: 5,
    criticalMultiplier: 2,
    unit: '%',
  },
};

export function evaluateSignal(
  type: DetectionSignalType,
  observedValue: number,
): DetectionSignal | undefined {
  const rule = DETECTION_RULES[type];

  if (!Number.isFinite(observedValue) || observedValue < rule.threshold) {
    return undefined;
  }

  return {
    type,
    observedValue,
    threshold: rule.threshold,
    severity:
      observedValue >= rule.threshold * rule.criticalMultiplier
        ? 'critical'
        : 'warning',
    unit: rule.unit,
  };
}
