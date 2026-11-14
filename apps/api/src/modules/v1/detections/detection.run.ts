import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../common/db";
import { detectionRuns } from "../../../common/db/schema";

export async function startDetectionRun(
  orgId: string,
  projectId: string,
  windowStart: Date,
  windowEnd: Date,
) {
  const [run] = await db
    .insert(detectionRuns)
    .values({
      orgId,
      projectId,
      windowStart,
      windowEnd,
      status: "running",
    })
    .returning();
  if (!run) throw new Error("Failed to create detection run");
  return run;
}

export async function completeDetectionRun(id: string, findingsCount: number) {
  const [run] = await db
    .update(detectionRuns)
    .set({ status: "completed", findingsCount, completedAt: new Date() })
    .where(and(eq(detectionRuns.id, id), eq(detectionRuns.status, "running")))
    .returning();
  if (!run) throw new Error("Detection run not found or not running");
  return run;
}

export async function failDetectionRun(id: string, error: string) {
  const [run] = await db
    .update(detectionRuns)
    .set({ status: "failed", error, completedAt: new Date() })
    .where(and(eq(detectionRuns.id, id), eq(detectionRuns.status, "running")))
    .returning();
  if (!run) throw new Error("Detection run not found or not running");
  return run;
}

export async function listDetectionRuns(
  orgId: string,
  projectId: string,
  limit = 20,
) {
  return db
    .select()
    .from(detectionRuns)
    .where(
      and(
        eq(detectionRuns.orgId, orgId),
        eq(detectionRuns.projectId, projectId),
      ),
    )
    .orderBy(desc(detectionRuns.startedAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export type ClaimedDetectionRun = {
  id: string;
  orgId: string;
  projectId: string;
  windowStart: Date;
  windowEnd: Date;
};

export async function enqueueDetectionRun(
  orgId: string,
  projectId: string,
  windowStart: Date,
  windowEnd: Date,
) {
  const [run] = await db
    .insert(detectionRuns)
    .values({
      orgId,
      projectId,
      windowStart,
      windowEnd,
      status: "queued",
    })
    .returning();

  if (!run) throw new Error("Failed to queue detection run");
  return run;
}

function rowsFromExecute(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object") {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as Record<string, unknown>[];
  }
  return [];
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid queued detection window");
  return parsed;
}

const DEFAULT_STALE_MINUTES = 30;
export const MAX_RUN_ATTEMPTS = 3;

function staleMinutes(): number {
  const parsed = Number(process.env.DETECTION_RUN_STALE_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_MINUTES;
}

export async function failExhaustedDetectionRuns(): Promise<void> {
  await db.execute(sql`
    UPDATE detection_runs
    SET status = 'failed',
        error = 'Worker stopped before the run finished',
        completed_at = now()
    WHERE status = 'running'
      AND attempts >= ${MAX_RUN_ATTEMPTS}
      AND started_at < now() - make_interval(mins => ${staleMinutes()})
  `);
}

export async function claimQueuedDetectionRun(): Promise<ClaimedDetectionRun | undefined> {
  await failExhaustedDetectionRuns();
  const result = await db.execute(sql`
    WITH claimed AS (
      SELECT id
      FROM detection_runs
      WHERE status = 'queued'
         OR (status = 'running'
             AND attempts < ${MAX_RUN_ATTEMPTS}
             AND started_at < now() - make_interval(mins => ${staleMinutes()}))
      ORDER BY started_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE detection_runs AS run
    SET status = 'running', started_at = now(), attempts = run.attempts + 1
    FROM claimed
    WHERE run.id = claimed.id
    RETURNING run.id AS "id",
              run.org_id AS "orgId",
              run.project_id AS "projectId",
              run.window_start AS "windowStart",
              run.window_end AS "windowEnd"
  `);

  const row = rowsFromExecute(result)[0];
  if (!row) return undefined;

  return {
    id: String(row.id),
    orgId: String(row.orgId),
    projectId: String(row.projectId),
    windowStart: toDate(row.windowStart),
    windowEnd: toDate(row.windowEnd),
  };
}
