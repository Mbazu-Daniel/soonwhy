import { type StoredErrorIssueStatus } from "../../../../../common/db/schema/error-issue-states";

export interface IssueScope {
  orgId: string;
  projectId: string;
}

export interface SaveIssueState extends IssueScope {
  fingerprint: string;
  status: StoredErrorIssueStatus;
  resolvedAt: Date | null;
  userId: string | null;
}
