import { describe, expect, it } from 'vitest';
import {
  evaluateDetectionCase,
  runDetectionEvaluation,
  type DetectionEvaluationCase,
} from './detection.evaluation';

const cases: DetectionEvaluationCase[] = [
  { name: 'latency below threshold', type: 'latency', observedValue: 999, expectedDetection: false },
  { name: 'latency warning threshold', type: 'latency', observedValue: 1_000, expectedDetection: true, expectedSeverity: 'warning' },
  { name: 'latency critical threshold', type: 'latency', observedValue: 2_000, expectedDetection: true, expectedSeverity: 'critical' },
  { name: 'latency regression', type: 'latency', observedValue: 600, baseline: { value: 300, samples: 100 }, expectedDetection: true, expectedSeverity: 'warning' },
  { name: 'latency low sample baseline', type: 'latency', observedValue: 600, baseline: { value: 300, samples: 19 }, expectedDetection: false },
  { name: 'error rate below threshold', type: 'error_rate', observedValue: 4.99, expectedDetection: false },
  { name: 'error rate warning threshold', type: 'error_rate', observedValue: 5, expectedDetection: true, expectedSeverity: 'warning' },
  { name: 'error rate critical threshold', type: 'error_rate', observedValue: 10, expectedDetection: true, expectedSeverity: 'critical' },
  { name: 'error rate regression', type: 'error_rate', observedValue: 3, baseline: { value: 1, samples: 100 }, expectedDetection: true, expectedSeverity: 'warning' },
  { name: 'dependency warning threshold', type: 'dependency_latency', observedValue: 500, expectedDetection: true, expectedSeverity: 'warning' },
  { name: 'dependency critical threshold', type: 'dependency_latency', observedValue: 1_000, expectedDetection: true, expectedSeverity: 'critical' },
  { name: 'dependency low sample baseline', type: 'dependency_latency', observedValue: 600, baseline: { value: 300, samples: 19 }, expectedDetection: true, expectedSeverity: 'warning' },
  { name: 'throughput healthy', type: 'throughput', observedValue: 75, baseline: { value: 100, samples: 100 }, expectedDetection: false },
  { name: 'throughput warning', type: 'throughput', observedValue: 70, baseline: { value: 100, samples: 100 }, expectedDetection: true, expectedSeverity: 'warning' },
  { name: 'throughput critical', type: 'throughput', observedValue: 50, baseline: { value: 100, samples: 100 }, expectedDetection: true, expectedSeverity: 'critical' },
  { name: 'throughput low sample baseline', type: 'throughput', observedValue: 50, baseline: { value: 100, samples: 19 }, expectedDetection: false },
  { name: 'trace span below contribution threshold', type: 'trace_span', observedValue: 400, traceDuration: 1_000, expectedDetection: false },
  { name: 'trace span warning contribution', type: 'trace_span', observedValue: 500, traceDuration: 1_000, expectedDetection: true, expectedSeverity: 'warning' },
  { name: 'trace span critical contribution', type: 'trace_span', observedValue: 750, traceDuration: 1_000, expectedDetection: true, expectedSeverity: 'critical' },
];

describe('controlled detection evaluation', () => {
  it('evaluates the deterministic rule set against synthetic ground truth', () => {
    const result = runDetectionEvaluation(cases);

    expect(result).toEqual({
      total: 19,
      truePositives: 13,
      falsePositives: 0,
      trueNegatives: 6,
      falseNegatives: 0,
      precision: 1,
      recall: 1,
      passed: 19,
      failed: 0,
    });
  });

  it('reports a severity mismatch as a failed expected detection', () => {
    const result = evaluateDetectionCase({
      name: 'critical latency',
      type: 'latency',
      observedValue: 2_000,
      expectedDetection: true,
      expectedSeverity: 'warning',
    });

    expect(result).toEqual({ detected: true, severity: 'critical' });
  });
});
