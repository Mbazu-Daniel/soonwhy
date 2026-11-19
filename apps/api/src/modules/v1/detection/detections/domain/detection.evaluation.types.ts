import { type DetectionBaseline, type DetectionSignalType } from "./detection.engine.types";

export type EvaluationSignalType =
  | DetectionSignalType
  | "throughput"
  | "trace_span";

export interface DetectionEvaluationCase {
  name: string;
  type: EvaluationSignalType;
  observedValue: number;
  baseline?: DetectionBaseline;
  traceDuration?: number;
  expectedDetection: boolean;
  expectedSeverity?: "warning" | "critical";
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
