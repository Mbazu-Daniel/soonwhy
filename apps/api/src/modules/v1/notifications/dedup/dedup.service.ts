import { Injectable, Logger } from "@nestjs/common";
import { db } from "../../../../common/db";
import {
  alertTriggers,
  alertRules,
  type AlertState,
} from "../../../../common/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { dispatchedAtOf } from "../domain/alert-dispatch";
import {
  canTransitionTriggerState,
  canResolveTrigger,
} from "../domain/alert-fsm";

interface NoDataPolicy {
  mode: "alerting" | "healthy";
  thresholdMinutes: number;
}

@Injectable()
export class DedupService {
  private readonly logger = new Logger(DedupService.name);

  async assess(
    orgId: string,
    projectId: string,
    rule: { id: string; name: string },
    now: Date,
  ): Promise<{ isDedupe: boolean; hasIncidentProtection: boolean }> {
    const { isDedupe } = await this.shouldDedupe(orgId, projectId, rule.id, now, rule.name);
    return { isDedupe, hasIncidentProtection: await this.hasActiveIncidentProtection(rule.id) };
  }

  async markFiring(alertRuleId: string): Promise<number> {
    const trigger = await this.activeTrigger(alertRuleId);
    if (!trigger) return 0;
    await this.updateAlertState(trigger.id, "firing", "Condition satisfied (deduped)");
    return trigger.streakCount;
  }

  async recover(alertRuleId: string): Promise<boolean> {
    const trigger = await this.activeTrigger(alertRuleId);
    if (!trigger) return false;
    await this.updateStreak(trigger.id, false);
    await this.updateAlertState(trigger.id, "healthy", "Condition no longer satisfied");
    await this.resolveTrigger(trigger.id);
    return true;
  }

  async markNoData(alertRuleId: string, policy: NoDataPolicy): Promise<void> {
    const trigger = await this.activeTrigger(alertRuleId);
    if (trigger) await this.transitionToNoData(trigger.id, policy);
  }

  private async activeTrigger(alertRuleId: string) {
    const [trigger] = await db
      .select({ id: alertTriggers.id, streakCount: alertTriggers.streakCount })
      .from(alertTriggers)
      .where(and(eq(alertTriggers.alertRuleId, alertRuleId), eq(alertTriggers.status, "active")))
      .limit(1);
    return trigger;
  }

  private async shouldDedupe(
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

    if (claimed.length > 0) return { isDedupe: false };

    const [active] = await db
      .update(alertTriggers)
      .set({ streakCount: sql`${alertTriggers.streakCount} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(alertTriggers.alertRuleId, alertRuleId),
          eq(alertTriggers.orgId, orgId),
          eq(alertTriggers.projectId, projectId),
          eq(alertTriggers.status, "active"),
        ),
      )
      .returning({ metadata: alertTriggers.metadata });

    const dispatchedAt = dispatchedAtOf(active?.metadata);
    if (dispatchedAt && dispatchedAt > cutoff) return { isDedupe: true, lastTriggered: dispatchedAt };
    return { isDedupe: false };
  }

  async markDispatched(
    alertRuleId: string,
    dispatchedAt: Date,
    severity: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(alertTriggers)
      .set({
        severity: severity as "critical" | "high" | "medium" | "low",
        metadata: { ...metadata, dispatchedAt: dispatchedAt.toISOString() },
        updatedAt: new Date(),
      })
      .where(and(eq(alertTriggers.alertRuleId, alertRuleId), eq(alertTriggers.status, "active")));
  }

  private async updateStreak(
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

  private async resolveTrigger(alertTriggerId: string): Promise<void> {
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

  private async updateAlertState(
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

  private async transitionToNoData(
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

  private async hasActiveIncidentProtection(alertRuleId: string): Promise<boolean> {
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
}
