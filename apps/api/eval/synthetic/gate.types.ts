export interface GateFloors {
  minOverallTop1: number;
  minControlRuns: number;
  maxControlFalseAlarms: number;
  scenarioMarginPoints: number;
  minTierRuns: number;
}

export interface BaselineEntry {
  score: number;
  runs: number;
}

export interface Baseline {
  description: string;
  split: string;
  overallTop1: number;
  scenarios: Record<string, BaselineEntry>;
}

export interface GateCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface GateResult {
  passed: boolean;
  checks: GateCheck[];
}
