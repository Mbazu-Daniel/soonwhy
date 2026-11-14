import { Injectable, Logger } from "@nestjs/common";
import { db } from "../../../../common/db";
import { alertRules, notificationChannels } from "../../../../common/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { AlertRuleSeverity } from "../../../../common/db/schema";

type ChannelRecord = typeof notificationChannels.$inferSelect;

const SEVERITY_RANK: Record<AlertRuleSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

@Injectable()
export class SeverityRoutingService {
  private readonly logger = new Logger(SeverityRoutingService.name);

  async getChannelsForSeverity(
    orgId: string,
    projectId: string,
    minSeverity: AlertRuleSeverity,
    alertRuleId?: string,
  ): Promise<ChannelRecord[]> {
    const ruleCondition =
      alertRules.minSeverity !== undefined
        ? eq(alertRules.minSeverity, minSeverity)
        : sql`true`;

    const rules = await db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.orgId, orgId),
          eq(alertRules.projectId, projectId),
          sql `${alertRules.status} = 'active'`,
        ),
      );

    if (!rules.length) {
      this.logger.warn(
        `No active alert rules found for org=${orgId}, project=${projectId}`,
      );
      return [];
    }

    const channelIds = new Set<string>();
    for (const rule of rules) {
      if (rule.channelIds && rule.channelIds.length > 0) {
        for (const cid of rule.channelIds) {
          channelIds.add(cid);
        }
      }
    }

    if (channelIds.size === 0) {
      this.logger.warn(
        `No channel IDs found in alert rules for org=${orgId}, project=${projectId}`,
      );
      return [];
    }

    const channels = await db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.orgId, orgId),
          eq(notificationChannels.projectId, projectId),
          sql
`${notificationChannels.id} IN (${String(channelIds).replace(/,/g, ",")})`,
          eq(notificationChannels.isActive, true),
        ),
      );

    this.logger.debug(
      `Found ${channels.length} channels for severity=${minSeverity}, ruleIds=${rules.map((r) => r.id).join(",")}`,
    );

    return channels;
  }

  async determineChannel(
    orgId: string,
    projectId: string,
    severity: AlertRuleSeverity,
    alertRuleId?: string,
  ): Promise<ChannelRecord | undefined> {
    const channels = await this.getChannelsForSeverity(
      orgId,
      projectId,
      severity,
      alertRuleId,
    );

    if (channels.length === 0) {
      const severityOrder: AlertRuleSeverity[] = [
        "critical",
        "high",
        "medium",
        "low",
      ];
      const currentIndex = severityOrder.indexOf(severity);

      if (currentIndex < severityOrder.length - 1) {
        const fallbackSeverity = severityOrder[currentIndex + 1]!;
        this.logger.log(
          `No channels for severity=${severity}, falling back to ${fallbackSeverity}`,
        );
        return this.determineChannel(
          orgId,
          projectId,
          fallbackSeverity,
          alertRuleId,
        );
      }
    }

    return channels[0] ?? undefined;
  }

  async routeAlert(
    orgId: string,
    projectId: string,
    severity: AlertRuleSeverity,
    alertRuleId: string,
    payload: any,
  ): Promise<{ channel?: ChannelRecord; success: boolean }> {
    const [rule] = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.id, alertRuleId));

    if (!rule) {
      this.logger.error(`Alert rule not found: ${alertRuleId}`);
      return { channel: undefined, success: false };
    }

    const channel = await this.determineChannel(
      orgId,
      projectId,
      severity,
      alertRuleId,
    );

    if (!channel) {
      this.logger.warn(
        `No channel found for alert rule=${alertRuleId}, severity=${severity}`,
      );
      return { channel: undefined, success: false };
    }

    this.logger.debug(
      `Routed alert rule=${alertRuleId}, severity=${severity} to channel=${channel.name} (${channel.type})`,
    );

    return { channel, success: true };
  }
}
