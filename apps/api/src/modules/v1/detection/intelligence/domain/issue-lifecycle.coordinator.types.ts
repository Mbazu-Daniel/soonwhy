import type { IssueLifecycle } from "./issue-lifecycle.types";

export type IssueLifecycleAction =
  | "created"
  | "updated"
  | "reopened"
  | "ignored";

export interface IssueLifecycleResult {
  action: IssueLifecycleAction;
  lifecycle?: IssueLifecycle;
}
