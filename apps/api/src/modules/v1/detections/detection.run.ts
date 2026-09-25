import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { detectionRuns } from '../../../common/db/schema';

export async function startDetectionRun(
  orgId: string,
  projectId: string,
  windowStart: Date,
  windowEnd: Date,
) {
  const [run] = await db.insert(detectionRuns).values({
    orgId,
    projectId,
    windowStart,
    windowEnd,
    status: 'running',
  }).returning();
  if (!run) throw new Error('Failed to create detection run');
  return run;
}

export async function completeDetectionRun(id: string, findingsCount: number) {
  const [run] = await db.update(detectionRuns)
    .set({ status: 'completed', findingsCount, completedAt: new Date() })
    .where(eq(detectionRuns.id, id))
    .returning();
  if (!run) throw new Error('Detection run not found');
  return run;
}

export async function failDetectionRun(id: string, error: string) {
  const [run] = await db.update(detectionRuns)
    .set({ status: 'failed', error, completedAt: new Date() })
    .where(eq(detectionRuns.id, id))
    .returning();
  if (!run) throw new Error('Detection run not found');
  return run;
}

export async function listDetectionRuns(orgId: string, projectId: string, limit = 20) {
  return db.select().from(detectionRuns)
    .where(and(eq(detectionRuns.orgId, orgId), eq(detectionRuns.projectId, projectId)))
    .orderBy(desc(detectionRuns.startedAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}
