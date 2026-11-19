import type { EvidenceConfidence } from "./evidence-confidence.types";
import type { EvidenceObservation, EvidenceWindow } from "./evidence.types";
import type { TelemetryIdentity } from "@soonwhy/shared";

export interface BuildIssueInput {
  identity: TelemetryIdentity;
  confidence: EvidenceConfidence;
  observations: EvidenceObservation[];
  windows: EvidenceWindow[];
}
