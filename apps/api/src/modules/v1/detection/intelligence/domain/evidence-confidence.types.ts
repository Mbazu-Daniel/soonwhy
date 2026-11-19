import type { EvidenceObservation, EvidenceWindow } from "./evidence.types";
import type { TelemetryIdentity } from "@soonwhy/shared";

export interface EvidenceConfidenceInput {
  identity: TelemetryIdentity;
  observations: EvidenceObservation[];
  windows: EvidenceWindow[];
  requiredWindows?: number;
  minimumObservations?: number;
  minimumIndependentSources?: number;
}

export interface EvidenceConfidence {
  identity: TelemetryIdentity;
  score: number;
  status: "candidate" | "supported" | "confirmed";
  observationCount: number;
  windowCount: number;
  independentSourceCount: number;
}

export interface EvidenceConfidenceWeights {
  repeatedWindows: number;
  observationDepth: number;
  sourceDiversity: number;
}
