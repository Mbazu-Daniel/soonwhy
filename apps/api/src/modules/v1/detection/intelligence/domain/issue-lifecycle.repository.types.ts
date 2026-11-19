import type { IssueLifecycle } from "./issue-lifecycle.types";

export interface SaveIssueLifecycleInput {
  orgId: string;
  projectId: string;
  lifecycle: IssueLifecycle;
}
