import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../../../common/db";
import { detectionRuns } from "../../../common/db/schema";

export interface DetectionRunHealthRow {
  id: string;
  projectId: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  findingsCount: number;
  error: string | null;
}

export interface DetectionRunHealthEntry {
  id: string;
  projectId: string;
  status: string;
  startedAt: string;
  durationMs: number | null;
  findingsCount: number;
  error: string | null;
}

const HEALTH_WINDOW_MS = 24 * 60 * 60_000;
const RECENT_RUNS = 10;
const FAILED_STATUS = "failed";
const SUCCEEDED_STATUS = "completed";

function durationMs(row: DetectionRunHealthRow): number | null {
  if (!row.completedAt) return null;
  const ms = row.completedAt.getTime() - row.startedAt.getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

function toEntry(row: DetectionRunHealthRow): DetectionRunHealthEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    durationMs: durationMs(row),
    findingsCount: row.findingsCount,
    error: row.error,
  };
}

export interface DetectionHealthSummary {
  window: { from: string; to: string };
  totals: {
    runs: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    findings: number;
    successRate: number | null;
    avgDurationMs: number | null;
    maxDurationMs: number | null;
  };
  lastRun: DetectionRunHealthEntry | null;
  recent: DetectionRunHealthEntry[];
}

export function summarizeDetectionRuns(
  rows: DetectionRunHealthRow[],
  now: Date,
): DetectionHealthSummary {
  const ordered = [...rows].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
  const durations = ordered
    .map(durationMs)
    .filter((ms): ms is number => ms !== null);
  const completed = ordered.filter(
    (row) => row.status === SUCCEEDED_STATUS,
  ).length;
  const failed = ordered.filter((row) => row.status === FAILED_STATUS).length;
  const finished = completed + failed;
  const maxDuration = durations.reduce<number | null>(
    (max, ms) => (max === null || ms > max ? ms : max),
    null,
  );

  return {
    window: {
      from: new Date(now.getTime() - HEALTH_WINDOW_MS).toISOString(),
      to: now.toISOString(),
    },
    totals: {
      runs: ordered.length,
      completed,
      failed,
      running: ordered.filter((row) => row.status === "running").length,
      queued: ordered.filter((row) => row.status === "queued").length,
      findings: ordered.reduce((sum, row) => sum + row.findingsCount, 0),
      successRate: finished === 0 ? null : completed / finished,
      avgDurationMs:
        durations.length === 0
          ? null
          : Math.round(
              durations.reduce((sum, ms) => sum + ms, 0) / durations.length,
            ),
      maxDurationMs: maxDuration,
    },
    lastRun: ordered[0] ? toEntry(ordered[0]) : null,
    recent: ordered.slice(0, RECENT_RUNS).map(toEntry),
  };
}

export async function getDetectionHealth(
  orgId: string,
  now = new Date(),
): Promise<DetectionHealthSummary> {
  const since = new Date(now.getTime() - HEALTH_WINDOW_MS);
  const rows = await db
    .select({
      id: detectionRuns.id,
      projectId: detectionRuns.projectId,
      status: detectionRuns.status,
      startedAt: detectionRuns.startedAt,
      completedAt: detectionRuns.completedAt,
      findingsCount: detectionRuns.findingsCount,
      error: detectionRuns.error,
    })
    .from(detectionRuns)
    .where(
      and(
        eq(detectionRuns.orgId, orgId),
        gte(detectionRuns.startedAt, since),
      ),
    )
    .orderBy(desc(detectionRuns.startedAt));

  return summarizeDetectionRuns(rows, now);
}
