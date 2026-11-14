import { Injectable } from "@nestjs/common";
import { db } from "../../../common/db";
import { incidents } from "../../../common/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

@Injectable()
export class IncidentsRepository {
  async createIncident(data: {
    incidentId: string;
    orgId: string;
    projectId: string;
    alertRuleId: string;
    severity: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    const [incident] = await db
      .insert(incidents)
      .values({
        ...data,
        status: "firing",
        lastEvaluatedAt: new Date(),
      })
      .returning();
    return incident;
  }

  async getIncidentByIncidentId(incidentId: string) {
    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.incidentId, incidentId));
    return incident;
  }

  async getActiveIncidentsForRule(alertRuleId: string) {
    return db
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.alertRuleId, alertRuleId),
          inArray(incidents.status, ["firing", "acknowledged"]),
        ),
      )
      .orderBy(desc(incidents.firedAt));
  }

  async acknowledgeIncident(
    id: number,
    acknowledgedBy: string,
    note?: string,
  ) {
    const [incident] = await db
      .update(incidents)
      .set({
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy,
        acknowledgementNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, id), eq(incidents.status, "firing")))
      .returning();
    return incident;
  }

  async resolveIncident(id: number, resolvedBy?: string, note?: string) {
    const [incident] = await db
      .update(incidents)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: resolvedBy ?? null,
        resolutionNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(incidents.id, id),
          inArray(incidents.status, ["firing", "acknowledged"]),
        ),
      )
      .returning();
    return incident;
  }

  async markRecoveryNotified(id: number) {
    const [incident] = await db
      .update(incidents)
      .set({
        recoveryNotified: true,
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, id), eq(incidents.recoveryNotified, false)))
      .returning();
    return incident;
  }

  async updateIncidentLastEvaluated(id: number) {
    await db
      .update(incidents)
      .set({
        lastEvaluatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, id));
  }

  async getIncidents(
    orgId: string,
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return db
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.orgId, orgId),
          eq(incidents.projectId, projectId),
        ),
      )
      .orderBy(desc(incidents.firedAt))
      .limit(limit)
      .offset(offset);
  }

  async getIncidentStats(orgId: string, projectId: string) {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        firing: sql<number>`count(*) filter (where ${incidents.status} = 'firing')::int`,
        acknowledged: sql<number>`count(*) filter (where ${incidents.status} = 'acknowledged')::int`,
        resolved: sql<number>`count(*) filter (where ${incidents.status} = 'resolved')::int`,
      })
      .from(incidents)
      .where(
        and(
          eq(incidents.orgId, orgId),
          eq(incidents.projectId, projectId),
        ),
      );

    return {
      total: stats?.total ?? 0,
      firing: stats?.firing ?? 0,
      acknowledged: stats?.acknowledged ?? 0,
      resolved: stats?.resolved ?? 0,
    };
  }
}
