import type { EvidenceObservation, EvidenceWindow } from './evidence.types';
import type { TelemetryIdentity } from './telemetry-identity.types';

export type IssueStatus = 'candidate' | 'supported' | 'confirmed';

export interface Issue {
  identity: TelemetryIdentity;
  status: IssueStatus;
  observations: EvidenceObservation[];
  windows: EvidenceWindow[];
  firstObservedAt?: string;
  lastObservedAt?: string;
}
