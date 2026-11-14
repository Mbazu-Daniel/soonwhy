import { Injectable, Logger } from "@nestjs/common";
import { db } from "../../../../common/db";
import {
  alertTriggers,
  alertRules,
  type AlertState,
} from "../../../../common/db/schema";
import { and, eq, sql, gt } from "drizzle-orm";
import {
  canTransitionTriggerState,
  canResolveTrigger,
} from "../alert-fsm";

interface NoDataPolicy {
  mode: "alerting" | "healthy";
  thresholdMinutes: number;
}

@Injectable()
export class DedupService {
  private readonly logger = new Logger(DedupService.name);

  async shouldDedupe(
    orgId: string,
    projectId: string,
    alertRuleId: string,
    triggeredAt: Date,
    alertName: string,
  ): Promise<{ isDedupe: boolean; lastTriggered?: Date }> {
    const [rule] = await db
      .select({ dedupeWindowSeconds: alertRules.dedupeWindowSeconds })
      .from(alertRules)
      .where(eq(alertRules.id, alertRuleId));

    if (!rule) return { isDedupe: false };

    const windowSeconds = rule.dedupeWindowSeconds ?? 300;
    const cutoff = new Date(triggeredAt.getTime() - windowSeconds * 1000);

    const claimed = await db
      .insert(alertTriggers)
      .values({
        orgId,
        projectId,
        alertRuleId,
        alertName,
        triggeredAt,
        status: "active",
        state: "firing",
        severity: "critical" as const,
        streakCount: 1,
        lastStreakResetAt: triggeredAt,
        metadata: {},
      })
      .onConflictDoNothing()
      .returning({ id: alertTriggers.id });

    if (claimed.length === 0) {
      const [recent] = await db
        .select({ triggeredAt: alertTriggers.triggeredAt })
        .from(alertTriggers)
        .where(
          and(
            eq(alertTriggers.alertRuleId, alertRuleId),
            eq(alertTriggers.orgId, orgId),
            eq(alertTriggers.projectId, projectId),
            eq(alertTriggers.status, "active"),
            gt(alertTriggers.triggeredAt, cutoff),
          ),
        )
        .orderBy(sql`${alertTriggers.triggeredAt} DESC`)
        .limit(1);
      return { isDedupe: true, lastTriggered: recent?.triggeredAt };
    }

    return { isDedupe: false };
  }

  async recordTrigger(
    orgId: string,
    projectId: string,
    alertRuleId: string,
    alertName: string,
    triggeredAt: Date,
    severity: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await db
      .insert(alertTriggers)
      .values({
        orgId,
        projectId,
        alertRuleId,
        alertName,
        triggeredAt,
        status: "active",
        state: "firing",
        severity: severity as "critical" | "high" | "medium" | "low",
        streakCount: 1,
        lastStreakResetAt: triggeredAt,
        metadata,
      })
      .onConflictDoNothing();
  }

  async updateStreak(
    alertTriggerId: string,
    increment: boolean,
  ): Promise<void> {
    if (increment) {
      await db
        .update(alertTriggers)
        .set({
          streakCount: sql`${alertTriggers.streakCount} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(alertTriggers.id, alertTriggerId), eq(alertTriggers.status, "active")));
    } else {
      await db
        .update(alertTriggers)
        .set({
          streakCount: 1,
          lastStreakResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(alertTriggers.id, alertTriggerId), eq(alertTriggers.status, "active")));
    }
  }

  async resolveTrigger(alertTriggerId: string): Promise<void> {
    const [current] = await db
      .select({ status: alertTriggers.status })
      .from(alertTriggers)
      .where(eq(alertTriggers.id, alertTriggerId))
      .limit(1);

    if (!current || !canResolveTrigger(current.status)) {
      this.logger.warn(`Skipping resolve for trigger ${alertTriggerId}: not active`);
      return;
    }

    await db
      .update(alertTriggers)
      .set({ status: "resolved", state: "healthy", updatedAt: new Date() })
      .where(and(eq(alertTriggers.id, alertTriggerId), eq(alertTriggers.status, "active")));
  }

  async updateAlertState(
    alertTriggerId: string,
    newState: AlertState,
    reason: string,
  ): Promise<void> {
    const [current] = await db
      .select({ state: alertTriggers.state, status: alertTriggers.status })
      .from(alertTriggers)
      .where(eq(alertTriggers.id, alertTriggerId))
      .limit(1);

    if (!current || current.status !== "active") {
      this.logger.warn(
        `Skipping state transition for trigger ${alertTriggerId}: not active (status=${current?.status ?? "missing"})`,
      );
      return;
    }

    const currentState = current.state as AlertState;
    if (!canTransitionTriggerState(currentState, newState)) {
      this.logger.warn(
        `Skipping invalid state transition for trigger ${alertTriggerId}: ${currentState} -> ${newState}`,
      );
      return;
    }

    await db
      .update(alertTriggers)
      .set({
        state: newState,
        stateTransitionReason: reason,
        lastStateTransitionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(alertTriggers.id, alertTriggerId), eq(alertTriggers.status, "active")));
  }

  async transitionToNoData(
    alertTriggerId: string,
    noDataPolicy: NoDataPolicy,
  ): Promise<void> {
    const trigger = await db
      .select({ lastStateTransitionAt: alertTriggers.lastStateTransitionAt })
      .from(alertTriggers)
      .where(eq(alertTriggers.id, alertTriggerId))
      .limit(1);

    if (!trigger[0]) return;

    const lastData = trigger[0].lastStateTransitionAt ?? new Date();
    const minutesSinceData = (Date.now() - lastData.getTime()) / 1000 / 60;

    if (minutesSinceData >= noDataPolicy.thresholdMinutes) {
      const targetState = noDataPolicy.mode === "alerting" ? "no_data" : "healthy";
      await this.updateAlertState(
        alertTriggerId,
        targetState,
        `No data for ${Math.round(minutesSinceData)} minutes (threshold: ${noDataPolicy.thresholdMinutes}m)`,
      );
    }
  }

  async hasActiveIncidentProtection(alertRuleId: string): Promise<boolean> {
    const [trigger] = await db
      .select({ streakCount: alertTriggers.streakCount, status: alertTriggers.status })
      .from(alertTriggers)
      .where(
        and(
          eq(alertTriggers.alertRuleId, alertRuleId),
          eq(alertTriggers.status, "active"),
        ),
      )
      .limit(1);

    return trigger ? trigger.streakCount >= 2 : false;
  }

  async getAlertState(alertRuleId: string): Promise<AlertState> {
    const [trigger] = await db
      .select({ state: alertTriggers.state, status: alertTriggers.status })
      .from(alertTriggers)
      .where(eq(alertTriggers.alertRuleId, alertRuleId))
      .orderBy(sql`${alertTriggers.triggeredAt} DESC`)
      .limit(1);

    if (!trigger || trigger.status === "resolved") return "healthy";
    return (trigger.state as AlertState) ?? "healthy";
  }
}
