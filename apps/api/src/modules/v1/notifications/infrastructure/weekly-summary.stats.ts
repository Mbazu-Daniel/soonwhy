import { and, count, gte, lt, sql } from "drizzle-orm";
import { db } from "../../../../common/db";
import { incidents, notificationLogs } from "../../../../common/db/schema";
import type { WeeklySummaryStats } from "../domain/weekly-summary.types";

export async function weeklySummaryStats(from: Date, to: Date): Promise<WeeklySummaryStats> {
  const [incidentRows, notificationRows] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${incidents.status} <> 'resolved')`.mapWith(Number),
        resolved: sql<number>`count(*) filter (where ${incidents.status} = 'resolved')`.mapWith(Number),
      })
      .from(incidents)
      .where(and(gte(incidents.firedAt, from), lt(incidents.firedAt, to))),
    db
      .select({
        total: count(),
        sent: sql<number>`count(*) filter (where ${notificationLogs.status} = 'sent')`.mapWith(Number),
        failed: sql<number>`count(*) filter (where ${notificationLogs.status} = 'failed')`.mapWith(Number),
      })
      .from(notificationLogs)
      .where(and(gte(notificationLogs.createdAt, from), lt(notificationLogs.createdAt, to))),
  ]);
  const incident = incidentRows[0] ?? { total: 0, active: 0, resolved: 0 };
  const notification = notificationRows[0] ?? { total: 0, sent: 0, failed: 0 };
  return {
    incidents: { total: Number(incident.total), active: incident.active, resolved: incident.resolved },
    notifications: { total: Number(notification.total), sent: notification.sent, failed: notification.failed },
  };
}
