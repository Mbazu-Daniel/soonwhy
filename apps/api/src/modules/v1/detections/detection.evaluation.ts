import {
  evaluateSignal,
  evaluateThroughput,
  evaluateTraceSpan,
  type DetectionBaseline,
  type DetectionSignalType,
} from './detection.engine';

export type EvaluationSignalType = DetectionSignalType | 'throughput' | 'trace_span';

export interface DetectionEvaluationCase {
  name: string;
  type: EvaluationSignalType;
  observedValue: number;
  baseline?: DetectionBaseline;
  traceDuration?: number;
  expectedDetection: boolean;
  expectedSeverity?: 'warning' | 'critical';
}

export interface DetectionEvaluationResult {
  total: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  passed: number;
  failed: number;
}

export function evaluateDetectionCase(testCase: DetectionEvaluationCase): {
  detected: boolean;
  severity?: 'warning' | 'critical';
} {
  const result = testCase.type === 'throughput'
    ? evaluateThroughput(testCase.observedValue, testCase.baseline)
    : testCase.type === 'trace_span'
      ? evaluateTraceSpan(testCase.observedValue, testCase.traceDuration ?? 0)
      : evaluateSignal(testCase.type, testCase.observedValue, testCase.baseline);

  return {
    detected: result !== undefined,
    severity: result?.severity,
  };
}

export function runDetectionEvaluation(
  cases: DetectionEvaluationCase[],
): DetectionEvaluationResult {
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;
  let passed = 0;

  for (const testCase of cases) {
    const result = evaluateDetectionCase(testCase);
    const matchesSeverity =
      testCase.expectedSeverity === undefined ||
      result.severity === testCase.expectedSeverity;
    const passedCase = result.detected === testCase.expectedDetection && matchesSeverity;

    if (passedCase) passed += 1;

    if (testCase.expectedDetection && result.detected) {
      if (matchesSeverity) truePositives += 1;
      else falseNegatives += 1;
    } else if (testCase.expectedDetection) {
      falseNegatives += 1;
    } else if (result.detected) {
      falsePositives += 1;
    } else {
      trueNegatives += 1;
    }
  }

  const precisionDenominator = truePositives + falsePositives;
  const recallDenominator = truePositives + falseNegatives;

  return {
    total: cases.length,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision: precisionDenominator === 0 ? 1 : truePositives / precisionDenominator,
    recall: recallDenominator === 0 ? 1 : truePositives / recallDenominator,
    passed,
    failed: cases.length - passed,
  };
}
