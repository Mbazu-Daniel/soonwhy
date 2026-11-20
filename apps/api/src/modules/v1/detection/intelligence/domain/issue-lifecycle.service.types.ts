import type { Issue } from "./issue.types";

export interface PersistIssueLifecycleInput {
  orgId: string;
  projectId: string;
  issue: Issue;
}
