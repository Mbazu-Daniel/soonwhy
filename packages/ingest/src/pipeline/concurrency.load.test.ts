import { describe, expect, it, vi } from 'vitest';
import { IngestConcurrency } from './concurrency';

describe('ingest concurrency load', () => {
  it('never exceeds global or per-organization limits under a 10,000-attempt burst', async () => {
    vi.stubEnv('INGEST_MAX_CONCURRENCY', '32');
    vi.stubEnv('INGEST_MAX_CONCURRENCY_PER_ORG', '8');
    const limiter = new IngestConcurrency();
    const activeByOrganization = new Map<string, number>();
    let peak = 0;
    let peakNoisyOrganization = 0;

    await Promise.all(Array.from({ length: 10_000 }, async (_, index) => {
      const organizationId = index % 2 === 0 ? 'noisy-org' : 'other-org';
      if (!limiter.tryAcquire(organizationId)) return;
      const active = (activeByOrganization.get(organizationId) ?? 0) + 1;
      activeByOrganization.set(organizationId, active);
      peak = Math.max(peak, limiter.snapshot().inFlight);
      peakNoisyOrganization = Math.max(peakNoisyOrganization, activeByOrganization.get('noisy-org') ?? 0);
      await Promise.resolve();
      limiter.release(organizationId);
      activeByOrganization.set(organizationId, Math.max(0, active - 1));
    }));

    expect(peak).toBeLessThanOrEqual(32);
    expect(peakNoisyOrganization).toBeLessThanOrEqual(8);
    expect(limiter.snapshot()).toMatchObject({ inFlight: 0, available: 32, saturated: false, organizations: 0 });
    vi.unstubAllEnvs();
  });
});
