import type { EvidenceConfidence } from "./evidence-confidence.types";
import type { EvidenceObservation, EvidenceWindow } from "./evidence.types";
import type { TelemetryIdentity } from "@soonwhy/shared";

export type IssueStatus = "candidate" | "supported" | "confirmed";

export interface Issue {
  identity: TelemetryIdentity;
  confidence: EvidenceConfidence;
  status: IssueStatus;
  observations: EvidenceObservation[];
  windows: EvidenceWindow[];
  firstObservedAt?: string;
  lastObservedAt?: string;
}
