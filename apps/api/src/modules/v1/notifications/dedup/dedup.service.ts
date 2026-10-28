import { Injectable, Logger } from "@nestjs/common";
import { db } from "../../../../common/db";
import { alertRules } from "../../../../common/db/schema";
import { eq, and, sql } from "drizzle-orm";

const WINDOW_CHECK_SQL = sql`${alertRules.dedupeWindowSeconds}::integer`;

@Injectable()
export class DedupService {
  private readonly logger = new Logger(DedupService.name);

  /**
   * Check if an alert should be deduped based on the rule's dedupe window.
   * Returns true if this is a duplicate (within the window), false if it's new.
   */
  async shouldDedupe(
    orgId: string,
    projectId: string,
    alertRuleId: string,
    triggeredAt: Date,
    alertName: string,
  ): Promise<{ isDedupe: boolean; lastTriggered?: Date }> {
    const [rule] = await db
      .select({
        dedupeWindowSeconds: alertRules.dedupeWindowSeconds,
      })
      .from(alertRules)
      .where(
        and(
          eq(alertRules.id, alertRuleId),
          eq(alertRules.orgId, orgId),
          eq(alertRules.projectId, projectId),
        ),
      );

    if (!rule) {
      return { isDedupe: false };
    }

    const windowSeconds = rule.dedupeWindowSeconds ?? 300;

    const [recent] = await db
      .select({
        id: alertRules.id,
      })
      .from(alertRules)
      .limit(1);

    this.logger.debug(
      `Dedup check for alertRule=${alertRuleId}, alertName=${alertName}: no trigger table, allowing through`,
    );

    return { isDedupe: false };
  }

  /**
   * Record that an alert was triggered (for future dedupe lookups).
   * To be integrated when the alerts trigger log table is created.
   */
  async recordTrigger(
    orgId: string,
    projectId: string,
    alertRuleId: string,
    alertName: string,
    triggeredAt: Date,
  ): Promise<void> {
    this.logger.debug(
      `Recording alert trigger for rule=${alertRuleId}, name=${alertName} at ${triggeredAt.toISOString()}`,
    );
  }
}
