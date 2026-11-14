import type { ErrorIssueStateRow } from "../../../common/db/schema/error-issue-states";
import type { ErrorIssueState } from "./error.types";

export const UNRESOLVED: ErrorIssueState = { status: "unresolved", resolvedAt: null };

export function deriveIssueState(
  row: Pick<ErrorIssueStateRow, "status" | "resolvedAt"> | undefined,
  lastSeen: string,
): ErrorIssueState {
  if (!row) return UNRESOLVED;
  if (row.status === "ignored") return { status: "ignored", resolvedAt: null };
  const resolvedAt = row.resolvedAt;
  const seenAfterResolve =
    resolvedAt !== null &&
    resolvedAt !== undefined &&
    Date.parse(lastSeen) > resolvedAt.getTime();
  return {
    status: seenAfterResolve ? "regressed" : "resolved",
    resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
  };
}
