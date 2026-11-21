import { sql } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { findings } from "../../../../../common/db/schema";
import { recurrenceUpdate } from "./finding-recurrence";

export async function upsertFinding(row: typeof findings.$inferInsert, seenAt?: Date) {
  const { orgId: _orgId, projectId: _projectId, serviceName: _serviceName, type: _type, category: _category, fingerprint: _fingerprint, ...fields } = row;
  const [saved] = await db
    .insert(findings)
    .values({ lastSeenAt: seenAt ?? new Date(), ...row })
    .onConflictDoUpdate({
      target: [findings.projectId, findings.fingerprint],
      targetWhere: sql`${findings.fingerprint} is not null`,
      set: { ...fields, ...recurrenceUpdate(seenAt) },
    })
    .returning();
  return saved;
}
