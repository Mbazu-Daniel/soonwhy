import type { TelemetryIdentity } from './telemetry-identity.types';

export type IssueLifecycleStatus = 'active' | 'resolved';

export interface IssueLifecycle {
  issueKey: string;
  identity: TelemetryIdentity;
  status: IssueLifecycleStatus;
  firstObservedAt: string;
  lastObservedAt: string;
  resolvedAt?: string;
}
