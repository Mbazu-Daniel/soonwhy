import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../../common/db';
import { alertRules, notificationChannels } from '../../../../common/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { AlertRuleCondition, AlertRuleConditionGroup } from './alert-rule-conditions';
import { TimeWindowParser } from './time-window-parser';

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

@Injectable()
export class AlertRuleEngineService {
  private readonly logger = new Logger(AlertRuleEngineService.name);

  /**
   * Evaluate an alert rule condition against provided metric data.
   */
  async evaluateCondition(
    condition: AlertRuleCondition,
    metricData: Record<string, unknown>,
    evaluationTime?: Date,
  ): Promise<{ result: string; details: Record<string, unknown> }> {
    const now = evaluationTime || new Date();
    const window = TimeWindowParser.parse(condition.window);

    switch (condition.type) {
      case 'threshold': {
        return this.evaluateThreshold(condition, metricData, now);
      }

      case 'rate': {
        return this.evaluateRate(condition, metricData, now);
      }

      case 'expression': {
        return this.evaluateExpression(condition, metricData, now);
      }

      default: {
        this.logger.warn(`Unknown condition type: ${condition.type}`);
        return { result: 'insufficient_data', details: {} };
      }
    }
  }

  private evaluateThreshold(
    condition: AlertRuleCondition,
    metricData: Record<string, unknown>,
    now: Date,
  ): Promise<{ result: string; details: Record<string, unknown> }> {
    return new Promise((resolve) => {
      const metric = this.extractMetricValue(metricData, condition.metric);

      if (metric === undefined) {
        resolve({
          result: 'insufficient_data',
          details: { reason: 'metric_not_found', metric: condition.metric },
        });
        return;
      }

      const value = condition.value as number;
      const operator = condition.operator;
      const negate = condition.negate ?? false;

      const shouldSatisfy = this.evaluateOperator(metric, operator, value);
      const result = negate ? !shouldSatisfy : shouldSatisfy;

      resolve({
        result: result ? 'satisfied' : 'not_satisfied',
        details: {
          metric: condition.metric,
          metricValue: metric,
          threshold: value,
          operator,
          satisfied: result,
          negated: negate,
        },
      });
    });
  }

  private evaluateRate(
    condition: AlertRuleCondition,
    metricData: Record<string, unknown>,
    now: Date,
  ): Promise<{ result: string; details: Record<string, unknown> }> {
    return new Promise((resolve) => {
      const window = TimeWindowParser.parse(condition.window);
      if (!window) {
        resolve({
          result: 'insufficient_data',
          details: { reason: 'rate_window_required' },
        });
        return;
      }

      const metric = this.extractMetricValue(metricData, condition.metric);
      const operator = condition.operator;
      const negate = condition.negate ?? false;

      if (metric === undefined) {
        resolve({
          result: 'insufficient_data',
          details: { reason: 'metric_not_found', metric: condition.metric },
        });
        return;
      }

      // Simplified rate: use current metric value as placeholder
      // Full implementation would compute (current - baseline) / window_duration
      const rate = metric; // placeholder

      const shouldSatisfy = this.evaluateOperator(rate, operator, condition.value as number);
      const result = negate ? !shouldSatisfy : shouldSatisfy;

      resolve({
        result: result ? 'satisfied' : 'not_satisfied',
        details: {
          metric: condition.metric,
          rate,
          window_start: window.start.toISOString(),
          window_end: window.end.toISOString(),
          operator,
          satisfied: result,
          negated: negate,
        },
      });
    });
  }

  private evaluateExpression(
    condition: AlertRuleCondition,
    metricData: Record<string, unknown>,
    now: Date,
  ): Promise<{ result: string; details: Record<string, unknown> }> {
    return new Promise((resolve) => {
      const dependsOn = condition.dependsOn || [];
      if (dependsOn.length === 0) {
        resolve({
          result: 'insufficient_data',
          details: { reason: 'no_conditions_to_evaluate' },
        });
        return;
      }

      // Placeholder: simple OR logic - any sub-condition satisfied means expression satisfied
      resolve({
        result: 'satisfied',
        details: {
          condition_type: 'expression',
          sub_conditions_evaluated: dependsOn.length,
        },
      });
    });
  }

  private extractMetricValue(metricData: Record<string, unknown>, metricPath: string): number | undefined {
    const parts = metricPath.split('.');
    let current: unknown = metricData;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (!(part in (current as Record<string, unknown>))) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    if (typeof current === 'number') return current;
    if (typeof current === 'string') return parseFloat(current);
    return undefined;
  }

  private evaluateOperator(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'gte': return actual >= expected;
      case 'lt': return actual < expected;
      case 'lte': return actual <= expected;
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      default: return false;
    }
  }

  /**
   * Get channels for alert based on severity and rule configuration
   */
  async getChannelsForSeverity(
    orgId: string,
    projectId: string,
    minSeverity: string,
  ): Promise<any[]> {
    const rules = await db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.orgId, orgId),
          eq(alertRules.projectId, projectId),
          eq(alertRules.status, 'active'),
        ),
      );

    const channelIds = new Set<string>();
    for (const rule of rules) {
      if (rule.channelIds) {
        for (const cid of rule.channelIds) {
          channelIds.add(cid);
        }
      }
    }

    if (channelIds.size === 0) return [];

    return db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.orgId, orgId),
          eq(notificationChannels.projectId, projectId),
          eq(notificationChannels.isActive, true),
        ),
      );
  }

  /**
   * Route an alert to the appropriate channel based on severity
   */
  async routeAlert(
    orgId: string,
    projectId: string,
    severity: string,
    alertRuleId: string,
  ): Promise<{ channel?: any; success: boolean }> {
    // Find the rule
    const [rule] = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.id, alertRuleId));

    if (!rule) {
      this.logger.error(`Alert rule not found: ${alertRuleId}`);
      return { channel: undefined, success: false };
    }

    // Determine channel based on severity
    const severityRank = SEVERITY_RANK[severity] ?? 0;
    const ruleRank = SEVERITY_RANK[rule.minSeverity] ?? 0;

    // If rule severity is higher than alert severity, use rule's channels
    if (ruleRank >= severityRank) {
      // Return channels from rule
      if (rule.channelIds && rule.channelIds.length > 0) {
        const [channel] = await db
          .select()
          .from(notificationChannels)
          .where(sql`${notificationChannels.id} IN (${String(rule.channelIds)})`);
        return { channel, success: true };
      }
    }

    // Fallback to lower severity or no routing
    return { channel: undefined, success: false };
  }
}
