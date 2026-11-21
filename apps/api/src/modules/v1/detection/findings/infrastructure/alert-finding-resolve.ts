import { and, eq } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { findings } from "../../../../../common/db/schema";
import { alertFindingFingerprint } from "../domain/alert-finding";

export async function resolveAlertFinding(projectId: string, ruleId: string, at: Date = new Date()): Promise<number> {
  const rows = await db
    .update(findings)
    .set({ status: "resolved", resolvedAt: at, resolvedBy: null })
    .where(
      and(
        eq(findings.projectId, projectId),
        eq(findings.fingerprint, alertFindingFingerprint(ruleId)),
        eq(findings.status, "open"),
      ),
    )
    .returning({ id: findings.id });
  return rows.length;
}
