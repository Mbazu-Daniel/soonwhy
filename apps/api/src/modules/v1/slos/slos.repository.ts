import { Injectable } from "@nestjs/common";
import { db } from "../../../common/db";
import { slos, sloComplianceSnapshots } from "../../../common/db/schema";
import { eq, and, desc, lt, gte } from "drizzle-orm";

@Injectable()
export class SlosRepository {
  async createSlo(data: {
    orgId: string;
    projectId: string;
    name: string;
    description?: string;
    serviceName: string;
    targetPercentage: number;
    period: string;
    measurementType: string;
    goodEventsThreshold?: number;
    windowSize?: number;
    alertOnBurnRate?: boolean;
    alertThresholds?: Record<string, unknown>;
  }) {
    const [slo] = await db
      .insert(slos)
      .values({
        ...data,
        isActive: true,
        windowSize: data.windowSize || 30,
      })
      .returning();
    return slo;
  }

  async getSlos(
    orgId: string,
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return db
      .select()
      .from(slos)
      .where(
        and(
          eq(slos.orgId, orgId),
          eq(slos.projectId, projectId),
          eq(slos.isActive, true),
        ),
      )
      .orderBy(desc(slos.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getSloById(id: number, orgId: string, projectId: string) {
    const [slo] = await db
      .select()
      .from(slos)
      .where(
        and(
          eq(slos.id, id),
          eq(slos.orgId, orgId),
          eq(slos.projectId, projectId),
        ),
      );
    return slo;
  }

  async updateSlo(
    id: number,
    orgId: string,
    projectId: string,
    data: {
      name?: string;
      description?: string;
      targetPercentage?: number;
      period?: string;
      measurementType?: string;
      goodEventsThreshold?: number;
      windowSize?: number;
      alertOnBurnRate?: boolean;
      alertThresholds?: Record<string, unknown>;
      isActive?: boolean;
    },
  ) {
    const [slo] = await db
      .update(slos)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(eq(slos.id, id), eq(slos.orgId, orgId), eq(slos.projectId, projectId)),
      )
      .returning();
    return slo;
  }

  async deleteSlo(id: number, orgId: string, projectId: string) {
    await db
      .delete(slos)
      .where(and(eq(slos.id, id), eq(slos.orgId, orgId), eq(slos.projectId, projectId)));
  }

  async updateSloCompliance(
    id: number,
    orgId: string,
    projectId: string,
    data: {
      currentCompliance: number;
      errorBudgetRemaining: number;
      errorBudgetBurnRate: string;
    },
  ) {
    await db
      .update(slos)
      .set({
        ...data,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(slos.id, id), eq(slos.orgId, orgId), eq(slos.projectId, projectId)));
  }

  async createComplianceSnapshot(data: {
    sloId: number;
    compliance: number;
    errorBudgetRemaining: number;
    goodEvents: number;
    totalEvents: number;
    windowStart: Date;
    windowEnd: Date;
  }) {
    const [snapshot] = await db
      .insert(sloComplianceSnapshots)
      .values({
        ...data,
        timestamp: new Date(),
      })
      .returning();
    return snapshot;
  }

  async getComplianceSnapshots(
    sloId: number,
    orgId: string,
    projectId: string,
    limit: number = 100,
  ) {
    return db
      .select()
      .from(sloComplianceSnapshots)
      .innerJoin(slos, eq(sloComplianceSnapshots.sloId, slos.id))
      .where(
        and(
          eq(sloComplianceSnapshots.sloId, sloId),
          eq(slos.orgId, orgId),
          eq(slos.projectId, projectId),
        ),
      )
      .orderBy(desc(sloComplianceSnapshots.timestamp))
      .limit(limit);
  }

  async getRecentSnapshotsForAllSlos(
    orgId: string,
    projectId: string,
    hoursAgo: number = 24,
  ) {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    return db
      .select({
        sloId: sloComplianceSnapshots.sloId,
        sloName: slos.name,
        serviceName: slos.serviceName,
        compliance: sloComplianceSnapshots.compliance,
        errorBudgetRemaining: sloComplianceSnapshots.errorBudgetRemaining,
        timestamp: sloComplianceSnapshots.timestamp,
      })
      .from(sloComplianceSnapshots)
      .innerJoin(slos, eq(sloComplianceSnapshots.sloId, slos.id))
      .where(
        and(
          eq(slos.orgId, orgId),
          eq(slos.projectId, projectId),
          gte(sloComplianceSnapshots.timestamp, cutoff),
        ),
      )
      .orderBy(desc(sloComplianceSnapshots.timestamp));
  }
}
