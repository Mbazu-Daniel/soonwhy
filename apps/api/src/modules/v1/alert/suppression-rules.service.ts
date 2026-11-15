import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { alertSuppressionRules } from "../../../common/db/schema";
import { db } from "../../../common/db";
import { eq, and } from "drizzle-orm";

interface SuppressionConditions {
  services?: string[];
  severity?: string[];
  timeRanges?: Array<{ start: string; end: string; daysOfWeek?: number[] }>;
  custom?: Array<{ field: string; operator: string; value: unknown }>;
}

interface SuppressionCheckParams {
  orgId: string;
  projectId: string;
  alertRuleId: string;
  service: string;
  severity: string;
  timestamp: Date;
}

@Injectable()
export class SuppressionRulesService {
  private readonly logger = new Logger(SuppressionRulesService.name);

  async createRule(data: {
    orgId: string;
    projectId: string;
    name: string;
    description?: string;
    conditions: SuppressionConditions;
    targetAlertRuleIds?: string[];
    targetServices?: string[];
    scheduleType: "always" | "scheduled" | "conditional";
    scheduleConfig?: Record<string, unknown>;
    conditionalConfig?: Record<string, unknown>;
  }) {
    const [created] = await db
      .insert(alertSuppressionRules)
      .values({
        ...data,
        conditions: data.conditions as any,
        targetAlertRuleIds: data.targetAlertRuleIds || null,
        targetServices: data.targetServices || null,
        scheduleConfig: data.scheduleConfig || null,
        conditionalConfig: data.conditionalConfig || null,
      })
      .returning();

    return created;
  }

  async getRules(orgId: string, projectId: string) {
    return db
      .select()
      .from(alertSuppressionRules)
      .where(
        and(
          eq(alertSuppressionRules.orgId, orgId),
          eq(alertSuppressionRules.projectId, projectId),
          eq(alertSuppressionRules.enabled, true),
        ),
      );
  }

  async updateRule(
    scope: { orgId: string; projectId: string },
    id: string,
    data: Partial<typeof alertSuppressionRules.$inferInsert>,
  ) {
    const { id: _id, orgId: _orgId, projectId: _projectId, createdAt: _createdAt, ...changes } = data;
    const [updated] = await db
      .update(alertSuppressionRules)
      .set({ ...changes, updatedAt: new Date() })
      .where(this.ownedBy(scope, id))
      .returning();
    if (!updated) throw new NotFoundException("Suppression rule not found");
    return updated;
  }

  async deleteRule(scope: { orgId: string; projectId: string }, id: string) {
    const deleted = await db
      .delete(alertSuppressionRules)
      .where(this.ownedBy(scope, id))
      .returning({ id: alertSuppressionRules.id });
    if (deleted.length === 0) throw new NotFoundException("Suppression rule not found");
  }

  private ownedBy(scope: { orgId: string; projectId: string }, id: string) {
    return and(
      eq(alertSuppressionRules.id, id),
      eq(alertSuppressionRules.orgId, scope.orgId),
      eq(alertSuppressionRules.projectId, scope.projectId),
    );
  }

  async shouldSuppressAlert(params: SuppressionCheckParams): Promise<{ suppressed: boolean; reason?: string }> {
    const rules = await this.getRules(params.orgId, params.projectId);

    for (const rule of rules) {
      if (await this.matchesRule(rule, params)) {
        return { suppressed: true, reason: `Matched suppression rule: ${rule.name}` };
      }
    }

    return { suppressed: false };
  }

  private async matchesRule(rule: any, params: SuppressionCheckParams): Promise<boolean> {
    if (rule.targetAlertRuleIds && !rule.targetAlertRuleIds.includes(params.alertRuleId)) {
      return false;
    }

    if (rule.targetServices && !rule.targetServices.includes(params.service)) {
      return false;
    }

    const conditions = rule.conditions as SuppressionConditions;
    if (conditions.severity && !conditions.severity.includes(params.severity)) {
      return false;
    }

    if (conditions.services && !conditions.services.includes(params.service)) {
      return false;
    }

    if (rule.scheduleType === "scheduled") {
      if (!this.isWithinSchedule(rule.scheduleConfig, params.timestamp)) {
        return false;
      }
    }

    if (rule.scheduleType === "conditional") {
      const matches = await this.checkConditional(rule.conditionalConfig, params);
      if (!matches) {
        return false;
      }
    }

    return true;
  }

  private isWithinSchedule(scheduleConfig: any, timestamp: Date): boolean {
    if (!scheduleConfig) return true;

    const config = scheduleConfig as {
      startTime?: string;
      endTime?: string;
      daysOfWeek?: number[];
      timezone?: string;
    };

    const now = new Date(timestamp);
    const currentTime = now.getHours() * 60 + now.getMinutes();

    if (config.daysOfWeek && !config.daysOfWeek.includes(now.getDay())) {
      return false;
    }

    if (config.startTime && config.endTime) {
      const [startH, startM] = config.startTime.split(":").map(Number);
      const [endH, endM] = config.endTime.split(":").map(Number);
      
      if (startH !== undefined && startM !== undefined && endH !== undefined && endM !== undefined) {
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        if (currentTime < startTime || currentTime > endTime) {
          return false;
        }
      }
    }

    return true;
  }

  private async checkConditional(_conditionalConfig: any, _params: SuppressionCheckParams): Promise<boolean> {
    return true;
  }
}
