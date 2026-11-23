import type { Interval, MethodName } from "./types";

export interface MethodScore {
  top1: Interval;
  top3: Interval;
  mrr: number;
}

export interface CellSummary {
  topology: string;
  scenario: string;
  runs: number;
  detected: Interval;
  methods: Record<MethodName, MethodScore>;
  meanCoverage: number;
  bothTruthsInTop2?: Interval;
}

export interface ControlSummary {
  topology: string;
  scenario: string;
  runs: number;
  falseAlarmRuns: Interval;
}

export interface CalibrationRow {
  tier: "high" | "medium" | "low";
  runs: number;
  top1: Interval;
}

export interface BaselineComparison {
  baseline: MethodName;
  runs: number;
  top1Difference: Interval;
  reciprocalRankDifference: Interval;
  beatsBaseline: boolean;
}

export interface Report {
  split: string;
  faultRuns: number;
  controlRuns: number;
  overall: Record<MethodName, MethodScore>;
  cells: CellSummary[];
  controls: ControlSummary[];
  byTopology: Array<{ topology: string; runs: number; methods: Record<MethodName, MethodScore> }>;
  calibration: CalibrationRow[];
  baselineComparison: BaselineComparison;
  scenariosWhereABaselineIsAhead: Array<{ topology: string; scenario: string; baseline: MethodName; fullTop1: number; baselineTop1: number }>;
}
