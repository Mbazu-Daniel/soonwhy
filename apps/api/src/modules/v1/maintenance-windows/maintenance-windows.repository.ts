import { Injectable } from "@nestjs/common";
import { db } from "../../../common/db";
import { maintenanceWindows } from "../../../common/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";

@Injectable()
export class MaintenanceWindowsRepository {
  async createMaintenanceWindow(data: {
    orgId: string;
    projectId: string;
    name: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    affectedServices?: string[];
    affectedAlertRules?: string[];
    recurringSchedule?: Record<string, unknown>;
  }) {
    if (data.endTime <= data.startTime) {
      throw new Error("Maintenance window end time must be after start time");
    }
    const [window] = await db
      .insert(maintenanceWindows)
      .values({
        ...data,
        isActive: true,
      })
      .returning();
    return window;
  }

  async getMaintenanceWindows(
    orgId: string,
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return db
      .select()
      .from(maintenanceWindows)
      .where(
        and(
          eq(maintenanceWindows.orgId, orgId),
          eq(maintenanceWindows.projectId, projectId),
        ),
      )
      .orderBy(maintenanceWindows.startTime)
      .limit(limit)
      .offset(offset);
  }

  async getActiveMaintenanceWindows(
    orgId: string,
    projectId: string,
    timestamp: Date = new Date(),
  ) {
    return db
      .select()
      .from(maintenanceWindows)
      .where(
        and(
          eq(maintenanceWindows.orgId, orgId),
          eq(maintenanceWindows.projectId, projectId),
          eq(maintenanceWindows.isActive, true),
          lt(maintenanceWindows.startTime, timestamp),
          gt(maintenanceWindows.endTime, timestamp),
        ),
      );
  }

  async updateMaintenanceWindow(
    id: number,
    data: {
      name?: string;
      description?: string;
      startTime?: Date;
      endTime?: Date;
      isActive?: boolean;
      affectedServices?: string[];
      affectedAlertRules?: string[];
      recurringSchedule?: Record<string, unknown>;
    },
  ) {
    const [existing] = await db
      .select({
        startTime: maintenanceWindows.startTime,
        endTime: maintenanceWindows.endTime,
      })
      .from(maintenanceWindows)
      .where(eq(maintenanceWindows.id, id))
      .limit(1);

    const startTime = data.startTime ?? existing?.startTime;
    const endTime = data.endTime ?? existing?.endTime;
    if (startTime && endTime && endTime <= startTime) {
      throw new Error("Maintenance window end time must be after start time");
    }

    const [window] = await db
      .update(maintenanceWindows)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceWindows.id, id))
      .returning();
    return window;
  }

  async deleteMaintenanceWindow(id: number) {
    await db.delete(maintenanceWindows).where(eq(maintenanceWindows.id, id));
  }

  async isAlertSuppressed(
    orgId: string,
    projectId: string,
    alertRuleId: string,
    serviceName?: string,
    timestamp: Date = new Date(),
  ): Promise<boolean> {
    const activeWindows = await this.getActiveMaintenanceWindows(
      orgId,
      projectId,
      timestamp,
    );

    for (const window of activeWindows) {
      // Check if alert rule is in affected list
      if (window.affectedAlertRules?.includes(alertRuleId)) {
        return true;
      }

      // Check if service is in affected list
      if (serviceName && window.affectedServices?.includes(serviceName)) {
        return true;
      }

      // If no specific rules/services, suppress all alerts
      if (
        (!window.affectedAlertRules || window.affectedAlertRules.length === 0) &&
        (!window.affectedServices || window.affectedServices.length === 0)
      ) {
        return true;
      }
    }

    return false;
  }
}
