import type { Issue } from "./issue.types";
import { createIssueLifecycle, updateIssueLifecycle } from "./issue-lifecycle.engine";
import type { IssueLifecycle } from "./issue-lifecycle.types";
import type { IssueLifecycleResult } from "./issue-lifecycle.coordinator.types";

export function applyIssueLifecycle(
  issue: Issue,
  current?: IssueLifecycle,
): IssueLifecycleResult {
  if (!current) {
    return {
      action: "created",
      lifecycle: createIssueLifecycle(issue),
    };
  }

  const updated = updateIssueLifecycle(current, issue);

  if (!updated) {
    return { action: "ignored" };
  }

  return {
    action: current.status === "resolved" ? "reopened" : "updated",
    lifecycle: updated,
  };
}
