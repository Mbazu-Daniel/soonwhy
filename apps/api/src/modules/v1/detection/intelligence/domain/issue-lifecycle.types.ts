import type { TelemetryIdentity } from "@soonwhy/shared";

export type IssueLifecycleStatus = "active" | "resolved";

export interface IssueLifecycle {
  issueKey: string;
  identity: TelemetryIdentity;
  status: IssueLifecycleStatus;
  firstObservedAt: string;
  lastObservedAt: string;
  resolvedAt?: string;
}
