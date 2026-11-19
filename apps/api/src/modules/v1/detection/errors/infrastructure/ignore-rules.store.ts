import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { errorIgnoreRules, type ErrorIgnoreRuleRow } from "../../../../../common/db/schema/error-ignore-rules";
import { ERROR_IGNORE_RULES_LIMIT } from "../domain/ignore-rules.constants";
import type { IssueScope } from "../domain/error-issue-states.store.types";

export async function listIgnoreRules(scope: IssueScope): Promise<ErrorIgnoreRuleRow[]> {
  return db
    .select()
    .from(errorIgnoreRules)
    .where(and(eq(errorIgnoreRules.orgId, scope.orgId), eq(errorIgnoreRules.projectId, scope.projectId)))
    .orderBy(desc(errorIgnoreRules.createdAt))
    .limit(ERROR_IGNORE_RULES_LIMIT);
}

export async function createIgnoreRule(
  scope: IssueScope,
  input: { pathPattern: string; status: string | null; userId: string | null },
): Promise<ErrorIgnoreRuleRow> {
  const [row] = await db
    .insert(errorIgnoreRules)
    .values({ ...scope, pathPattern: input.pathPattern, status: input.status, createdBy: input.userId })
    .returning();
  if (!row) throw new Error("Failed to save the ignore rule");
  return row;
}

export async function updateIgnoreRule(
  scope: IssueScope,
  id: string,
  input: { pathPattern: string; status: string | null },
): Promise<ErrorIgnoreRuleRow | undefined> {
  const [row] = await db
    .update(errorIgnoreRules)
    .set({ pathPattern: input.pathPattern, status: input.status, updatedAt: new Date() })
    .where(
      and(
        eq(errorIgnoreRules.id, id),
        eq(errorIgnoreRules.orgId, scope.orgId),
        eq(errorIgnoreRules.projectId, scope.projectId),
      ),
    )
    .returning();
  return row;
}

export async function deleteIgnoreRule(scope: IssueScope, id: string): Promise<boolean> {
  const rows = await db
    .delete(errorIgnoreRules)
    .where(
      and(
        eq(errorIgnoreRules.id, id),
        eq(errorIgnoreRules.orgId, scope.orgId),
        eq(errorIgnoreRules.projectId, scope.projectId),
      ),
    )
    .returning({ id: errorIgnoreRules.id });
  return rows.length > 0;
}
