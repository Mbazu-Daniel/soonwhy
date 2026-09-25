import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../../../common/db';
import {
  billingEvents,
  billingPlans,
  billingPlanQuotas,
  subscriptions,
  usageEvents,
  type UsageMetric,
} from '../../../common/db/schema';

export type RecordUsageInput = {
  orgId: string;
  projectId?: string;
  metric: UsageMetric;
  quantity: number;
  source: string;
  idempotencyKey?: string;
  occurredAt?: Date;
  metadata?: Record<string, string | number | boolean | null>;
};

export class BillingRepository {
  async getSubscription(orgId: string) {
    const [row] = await db
      .select({ subscription: subscriptions, plan: billingPlans })
      .from(subscriptions)
      .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
      .where(and(
        eq(subscriptions.orgId, orgId),
        inArray(subscriptions.status, ['active', 'trialing']),
        eq(billingPlans.active, true),
      ))
      .limit(1);
    return row;
  }

  async getQuotas(planId: string) {
    return db.select().from(billingPlanQuotas).where(eq(billingPlanQuotas.planId, planId));
  }

  async getRecentBillingEvents(orgId: string, limit = 20) {
    return db.select().from(billingEvents)
      .where(eq(billingEvents.orgId, orgId))
      .orderBy(desc(billingEvents.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async getQuota(planId: string, metric: UsageMetric) {
    const [row] = await db
      .select()
      .from(billingPlanQuotas)
      .where(and(eq(billingPlanQuotas.planId, planId), eq(billingPlanQuotas.metric, metric)))
      .limit(1);
    return row;
  }

  async recordUsage(input: RecordUsageInput) {
    const [event] = await db.insert(usageEvents).values(input).onConflictDoNothing().returning();
    return event ?? null;
  }

  async recordUsageWithQuota(input: RecordUsageInput, limit: number | null) {
    return db.transaction(async (tx) => {
      const occurredAt = input.occurredAt ?? new Date();
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.orgId + ':' + input.metric}))`);

      if (input.idempotencyKey) {
        const [existing] = await tx.select().from(usageEvents).where(and(
          eq(usageEvents.orgId, input.orgId),
          eq(usageEvents.idempotencyKey, input.idempotencyKey),
        )).limit(1);
        if (existing) return { event: null, quotaExceeded: false };
      }

      const periodStart = startOfMonth(occurredAt);
      const periodEnd = endOfMonth(occurredAt);

      if (limit !== null) {
        const [usage] = await tx.select({ quantity: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)` })
          .from(usageEvents)
          .where(and(
            eq(usageEvents.orgId, input.orgId),
            eq(usageEvents.metric, input.metric),
            gte(usageEvents.occurredAt, periodStart),
            lt(usageEvents.occurredAt, periodEnd),
          ));

        const current = Number(usage?.quantity ?? 0);
        if (current + input.quantity > limit) {
          await tx.insert(billingEvents).values({
            orgId: input.orgId,
            type: 'quota_exceeded',
            metric: input.metric,
            quantity: input.quantity,
            periodStart,
            periodEnd,
            status: 'rejected',
            metadata: { current, limit, source: input.source },
          });
          return { event: null, quotaExceeded: true };
        }
      }

      const [event] = await tx.insert(usageEvents).values({ ...input, occurredAt }).onConflictDoNothing().returning();
      if (!event) return { event: null, quotaExceeded: false };

      await tx.insert(billingEvents).values({
        orgId: event.orgId,
        type: 'usage_recorded',
        metric: event.metric,
        quantity: event.quantity,
        periodStart,
        periodEnd,
        status: 'recorded',
        metadata: { source: event.source },
      });

      return { event, quotaExceeded: false };
    });
  }

  async getUsage(orgId: string, periodStart: Date, periodEnd: Date, projectId?: string) {
    return db.select({
      metric: usageEvents.metric,
      quantity: sql<number>`sum(${usageEvents.quantity})`,
    }).from(usageEvents).where(and(
      eq(usageEvents.orgId, orgId),
      projectId ? eq(usageEvents.projectId, projectId) : undefined,
      gte(usageEvents.occurredAt, periodStart),
      lt(usageEvents.occurredAt, periodEnd),
    )).groupBy(usageEvents.metric).orderBy(desc(usageEvents.metric));
  }

  async recordBillingEvent(input: {
    orgId: string;
    type: 'usage_recorded' | 'quota_exceeded' | 'subscription_started' | 'subscription_changed' | 'subscription_cancelled' | 'trial_started' | 'trial_ended';
    metric?: UsageMetric;
    quantity?: number;
    periodStart?: Date;
    periodEnd?: Date;
    externalEventId?: string;
    status: string;
    metadata?: Record<string, string | number | boolean | null>;
  }) {
    const [event] = await db.insert(billingEvents).values(input).onConflictDoNothing().returning();
    return event ?? null;
  }
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}
