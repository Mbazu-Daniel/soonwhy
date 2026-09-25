import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  it('records usage through the atomic repository path', async () => {
    const occurredAt = new Date('2026-09-15T12:00:00.000Z');
    const event = { id: 'usage-1', orgId: 'org-1', metric: 'trace_spans' as const, quantity: 12, source: 'ingest', occurredAt };
    const repository = {
      recordUsage: vi.fn(),
      recordUsageWithQuota: vi.fn().mockResolvedValue({ event, quotaExceeded: false }),
      recordBillingEvent: vi.fn(),
      getSubscription: vi.fn(),
      getQuota: vi.fn(),
      getUsage: vi.fn(),
    };
    const service = new BillingService(repository as never);

    await service.recordUsage({ orgId: 'org-1', metric: 'trace_spans', quantity: 12, source: 'ingest', occurredAt });

    expect(repository.recordUsageWithQuota).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-1', metric: 'trace_spans', quantity: 12, occurredAt,
    }), null);
    expect(repository.recordBillingEvent).not.toHaveBeenCalled();
  });

  it('rejects usage when the configured quota would be exceeded', async () => {
    const repository = {
      recordUsage: vi.fn(),
      recordUsageWithQuota: vi.fn(),
      recordBillingEvent: vi.fn().mockResolvedValue({ id: 'billing-2' }),
      getSubscription: vi.fn().mockResolvedValue({ subscription: { planId: 'plan-1' }, plan: { name: 'starter' } }),
      getQuota: vi.fn().mockResolvedValue({ limit: 100 }),
      getUsage: vi.fn().mockResolvedValue([{ metric: 'trace_spans', quantity: 95 }]),
    };
    const service = new BillingService(repository as never);
    await expect(service.assertQuota('org-1', 'trace_spans', 6)).rejects.toThrow('Usage quota exceeded');
    expect(repository.recordBillingEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'quota_exceeded', status: 'rejected' }));
  });

  it('rejects an atomic usage write when the quota is exceeded', async () => {
    const repository = {
      recordUsage: vi.fn(),
      recordUsageWithQuota: vi.fn().mockResolvedValue({ event: null, quotaExceeded: true }),
      recordBillingEvent: vi.fn(),
      getSubscription: vi.fn().mockResolvedValue({ subscription: { planId: 'plan-1' }, plan: { name: 'starter' } }),
      getQuota: vi.fn().mockResolvedValue({ limit: 100 }),
      getUsage: vi.fn(),
    };
    const service = new BillingService(repository as never);
    await expect(service.recordUsage({ orgId: 'org-1', metric: 'trace_spans', quantity: 6, source: 'ingest' }))
      .rejects.toThrow('Usage quota exceeded for trace_spans');
  });

  it('returns a tenant-scoped billing dashboard', async () => {
    const repository = {
      recordUsage: vi.fn(), recordUsageWithQuota: vi.fn(), recordBillingEvent: vi.fn(),
      getSubscription: vi.fn().mockResolvedValue({ subscription: { planId: 'plan-1', status: 'trialing' }, plan: { name: 'starter' } }),
      getQuota: vi.fn(), getQuotas: vi.fn().mockResolvedValue([{ metric: 'trace_spans', limit: 1000, unit: 'spans' }]),
      getUsage: vi.fn().mockResolvedValue([{ metric: 'trace_spans', quantity: 42 }]),
      getRecentBillingEvents: vi.fn().mockResolvedValue([{ type: 'usage_recorded' }]),
    };
    const service = new BillingService(repository as never);
    const dashboard = await service.getDashboard('org-1', new Date('2026-09-15T12:00:00.000Z'));
    expect(repository.getSubscription).toHaveBeenCalledWith('org-1');
    expect(repository.getRecentBillingEvents).toHaveBeenCalledWith('org-1');
    expect(dashboard.usage).toEqual([{ metric: 'trace_spans', quantity: 42 }]);
    expect(dashboard.quotas).toEqual([{ metric: 'trace_spans', limit: 1000, unit: 'spans' }]);
  });

  it('supports project-scoped usage', async () => {
    const repository = {
      recordUsage: vi.fn(), recordUsageWithQuota: vi.fn(), recordBillingEvent: vi.fn(),
      getSubscription: vi.fn(), getQuota: vi.fn(),
      getUsage: vi.fn().mockResolvedValue([{ metric: 'ai_tokens', quantity: 200 }]),
    };
    const service = new BillingService(repository as never);
    const start = new Date('2026-09-01T00:00:00.000Z');
    const end = new Date('2026-10-01T00:00:00.000Z');
    await service.getUsage('org-1', start, end, 'project-1');
    expect(repository.getUsage).toHaveBeenCalledWith('org-1', start, end, 'project-1');
  });

  it('allows usage when no subscription or quota is configured', async () => {
    const repository = {
      recordUsage: vi.fn(), recordUsageWithQuota: vi.fn(), recordBillingEvent: vi.fn(),
      getSubscription: vi.fn().mockResolvedValue(null), getQuota: vi.fn(), getUsage: vi.fn(),
    };
    const service = new BillingService(repository as never);
    await expect(service.assertQuota('org-1', 'ai_tokens', 100)).resolves.toBeUndefined();
  });
});
