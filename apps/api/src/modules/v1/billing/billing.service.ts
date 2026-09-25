import { Injectable } from '@nestjs/common';
import { BillingRepository } from './billing.repository';
import { DEFAULT_USAGE_LIMITS, type BillingPlan } from './billing.constants';
import type { UsageMetric } from '../../../common/db/schema/billing';

@Injectable()
export class BillingService {
  constructor(private readonly repository: BillingRepository) {}

  async recordUsage(input: {
    orgId: string;
    projectId?: string;
    metric: UsageMetric;
    quantity: number;
    source: string;
    idempotencyKey?: string;
    occurredAt?: Date;
    metadata?: Record<string, string | number | boolean | null>;
  }) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new Error('Usage quantity must be a positive integer');
    }

    const limit = await this.getUsageLimit(input.orgId, input.metric);
    const outcome = await this.repository.recordUsageWithQuota(input, limit);
    if (outcome.quotaExceeded) {
      throw new Error(`Usage quota exceeded for ${input.metric}`);
    }

    return outcome.event;
  }

  private async getUsageLimit(orgId: string, metric: UsageMetric) {
    const subscription = await this.repository.getSubscription(orgId);
    if (!subscription) return null;

    const configuredQuota = await this.repository.getQuota(subscription.subscription.planId, metric);
    const configuredLimit = configuredQuota?.limit ?? null;
    const fallback = DEFAULT_USAGE_LIMITS[subscription.plan.name as BillingPlan]?.find(
      (item) => item.metric === metric,
    );
    return configuredLimit ?? fallback?.limit ?? null;
  }

  async assertQuota(orgId: string, metric: UsageMetric, additional = 0, at = new Date()) {
    if (!Number.isInteger(additional) || additional < 0) {
      throw new Error('Additional usage must be a non-negative integer');
    }

    const subscription = await this.repository.getSubscription(orgId);
    if (!subscription) return;

    const configuredQuota = await this.repository.getQuota(subscription.subscription.planId, metric);
    const configuredLimit = configuredQuota?.limit ?? null;
    const fallback = DEFAULT_USAGE_LIMITS[subscription.plan.name as BillingPlan]?.find(
      (item) => item.metric === metric,
    );
    const limit = configuredLimit ?? fallback?.limit ?? null;
    if (limit === null) return;

    const periodStart = startOfMonth(at);
    const periodEnd = endOfMonth(at);
    const usage = await this.repository.getUsage(orgId, periodStart, periodEnd);
    const current = usage.find((item) => item.metric === metric)?.quantity ?? 0;

    if (current + additional > limit) {
      await this.repository.recordBillingEvent({
        orgId,
        type: 'quota_exceeded',
        metric,
        quantity: additional,
        periodStart,
        periodEnd,
        status: 'rejected',
        metadata: { current, limit },
      });
      throw new Error(`Usage quota exceeded for ${metric}`);
    }
  }

  async getUsage(orgId: string, periodStart: Date, periodEnd: Date, projectId?: string) {
    const usage = await this.repository.getUsage(orgId, periodStart, periodEnd, projectId);
    return usage.map((item) => ({ metric: item.metric, quantity: Number(item.quantity) }));
  }

  async getSubscription(orgId: string) {
    return this.repository.getSubscription(orgId);
  }

  async getDashboard(orgId: string, at = new Date(), projectId?: string) {
    const subscription = await this.repository.getSubscription(orgId);
    const periodStart = startOfMonth(at);
    const periodEnd = endOfMonth(at);
    const usage = await this.getUsage(orgId, periodStart, periodEnd, projectId);

    if (!subscription) {
      return {
        subscription: null,
        period: { start: periodStart, end: periodEnd },
        projectId: projectId ?? null,
        usage,
        quotas: [],
        recentEvents: await this.repository.getRecentBillingEvents(orgId),
      };
    }

    const quotas = await this.repository.getQuotas(subscription.subscription.planId);
    return {
      subscription,
      period: { start: periodStart, end: periodEnd },
      projectId: projectId ?? null,
      usage,
      quotas,
      recentEvents: await this.repository.getRecentBillingEvents(orgId),
    };
  }
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}
