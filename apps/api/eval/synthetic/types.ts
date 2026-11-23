export interface Edge {
  target: string;
}

export interface Step {
  calls: Edge[];
  parallel: boolean;
}

export interface ServiceSpec {
  work: number;
  steps: Step[];
}

export interface Topology {
  name: string;
  entry: string;
  services: Record<string, ServiceSpec>;
  targets: string[];
  pairs: Array<[string, string]>;
}

export interface Fault {
  delayMs?: number;
  errorRate?: number;
  spinMs?: number;
}

export interface Distortion {
  sampleDrop: number;
  skewMs: number;
  orphanRate: number;
}

export interface Benign {
  workScale: number;
  noisy: boolean;
}

export interface CaseSpec {
  id: string;
  truth: string[];
  faults: Record<string, Fault>;
  absorbers: string[];
  retries: number;
  distortion: Distortion;
  benign: Benign;
}

export interface ScenarioDef {
  name: string;
  reps: number;
  build(topology: Topology): CaseSpec[];
}

export type Split = "tuning" | "locked";

export type MethodName = "full" | "anomalyOnly" | "criticalPathOnly" | "errorPropagationOnly" | "firstError" | "mostErrors";

export interface RunRow {
  topology: string;
  scenario: string;
  caseId: string;
  rep: number;
  seed: number;
  split: Split;
  truth: string[];
  detected: boolean;
  preOnsetFinding: boolean;
  falseAlarm: boolean;
  initialRank: Record<MethodName, number | null>;
  finalRank: Record<MethodName, number | null>;
  fullWorstTruthRank: number | null;
  confidence: "high" | "medium" | "low" | null;
  coverage: number | null;
}

export interface Interval {
  value: number;
  low: number;
  high: number;
}

export interface SoakResult {
  topology: string;
  hours: number;
  requests: number;
  findingEpisodes: number;
  episodesPerHour: number;
  snapshotsPerHour: number;
}
