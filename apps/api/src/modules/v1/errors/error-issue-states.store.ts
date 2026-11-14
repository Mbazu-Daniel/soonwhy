import { and, eq } from "drizzle-orm";
import { db } from "../../../common/db";
import {
  errorIssueStates,
  type ErrorIssueStateRow,
  type StoredErrorIssueStatus,
} from "../../../common/db/schema/error-issue-states";
import { ERROR_ISSUE_STATES_LIMIT } from "./error.constants";

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

function keyOf(scope: IssueScope, fingerprint: string) {
  return and(
    eq(errorIssueStates.orgId, scope.orgId),
    eq(errorIssueStates.projectId, scope.projectId),
    eq(errorIssueStates.fingerprint, fingerprint),
  );
}

export async function findIssueState(
  scope: IssueScope,
  fingerprint: string,
): Promise<ErrorIssueStateRow | undefined> {
  const [row] = await db
    .select()
    .from(errorIssueStates)
    .where(keyOf(scope, fingerprint))
    .limit(1);
  return row;
}

export async function listIssueStates(
  scope: IssueScope,
): Promise<Map<string, ErrorIssueStateRow>> {
  const rows = await db
    .select()
    .from(errorIssueStates)
    .where(
      and(
        eq(errorIssueStates.orgId, scope.orgId),
        eq(errorIssueStates.projectId, scope.projectId),
      ),
    )
    .limit(ERROR_ISSUE_STATES_LIMIT);
  return new Map(rows.map((row) => [row.fingerprint, row]));
}

export async function saveIssueState(input: SaveIssueState): Promise<ErrorIssueStateRow> {
  const values = {
    status: input.status,
    resolvedAt: input.resolvedAt,
    updatedBy: input.userId,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(errorIssueStates)
    .values({
      orgId: input.orgId,
      projectId: input.projectId,
      fingerprint: input.fingerprint,
      ...values,
    })
    .onConflictDoUpdate({
      target: [errorIssueStates.orgId, errorIssueStates.projectId, errorIssueStates.fingerprint],
      set: values,
    })
    .returning();
  return row as ErrorIssueStateRow;
}

export async function clearIssueState(scope: IssueScope, fingerprint: string): Promise<void> {
  await db.delete(errorIssueStates).where(keyOf(scope, fingerprint));
}
