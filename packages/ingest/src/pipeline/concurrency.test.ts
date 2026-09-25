import { describe, expect, it, vi } from 'vitest';
import { IngestConcurrency } from './concurrency';

describe('IngestConcurrency', () => {
  it('bounds global concurrent ingestion work', () => {
    vi.stubEnv('INGEST_MAX_CONCURRENCY', '2');
    vi.stubEnv('INGEST_MAX_CONCURRENCY_PER_ORG', '2');
    const limiter = new IngestConcurrency();

    expect(limiter.tryAcquire('org-1')).toBe(true);
    expect(limiter.tryAcquire('org-2')).toBe(true);
    expect(limiter.tryAcquire('org-3')).toBe(false);
    expect(limiter.snapshot()).toMatchObject({ limit: 2, perOrganizationLimit: 2, inFlight: 2, available: 0, saturated: true, organizations: 2 });

    limiter.release('org-1');
    expect(limiter.tryAcquire('org-3')).toBe(true);
    expect(limiter.tryAcquire('org-3')).toBe(false);
    limiter.release('org-2');
    limiter.release('org-3');
    limiter.release('org-3');

    expect(limiter.snapshot()).toMatchObject({ limit: 2, perOrganizationLimit: 2, inFlight: 0, available: 2, saturated: false, organizations: 0 });
    vi.unstubAllEnvs();
  });

  it('prevents one organization from exhausting global capacity', () => {
    vi.stubEnv('INGEST_MAX_CONCURRENCY', '8');
    vi.stubEnv('INGEST_MAX_CONCURRENCY_PER_ORG', '2');
    const limiter = new IngestConcurrency();

    expect(limiter.tryAcquire('noisy-org')).toBe(true);
    expect(limiter.tryAcquire('noisy-org')).toBe(true);
    expect(limiter.tryAcquire('noisy-org')).toBe(false);
    expect(limiter.tryAcquire('other-org')).toBe(true);
    expect(limiter.snapshot()).toMatchObject({ inFlight: 3, perOrganizationLimit: 2, saturated: false, organizations: 2 });

    limiter.release('noisy-org');
    limiter.release('noisy-org');
    limiter.release('other-org');
    vi.unstubAllEnvs();
  });
});
