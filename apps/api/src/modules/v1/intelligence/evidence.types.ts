import type {
  CanonicalValue,
  TelemetryIdentity,
} from "./telemetry-identity.types";

export type EvidenceSource =
  | "metric"
  | "trace"
  | "log"
  | "request"
  | "database"
  | "runtime"
  | "deployment"
  | "ai";

export interface EvidenceObservation {
  name: string;
  value: CanonicalValue;
  source: EvidenceSource;
  observedAt: string;
  unit?: string;
  dimensions?: Record<string, CanonicalValue>;
}

export interface EvidenceWindow {
  start: string;
  end: string;
}

export interface EvidenceBundle {
  observations: EvidenceObservation[];
  window: EvidenceWindow;
}

export interface EvidenceCitation {
  observationId: string;
  confidence: number;
  relevance: "high" | "medium" | "low";
}

export interface CorrelationLink {
  relatedIdentity: TelemetryIdentity;
  linkType: "causes" | "caused_by" | "correlated_with" | "same_trace" | "same_deployment";
  strength: number;
}

export interface IssueCandidate {
  identity: TelemetryIdentity;
  evidence: EvidenceBundle;
  citations: EvidenceCitation[];
  correlations: CorrelationLink[];
  confidence: number;
  status: "candidate" | "confirmed";
}
