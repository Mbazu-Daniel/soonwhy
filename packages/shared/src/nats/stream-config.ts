const NANOSECONDS_PER_SECOND = 1_000_000_000;

export const NATS_DEFAULT_MAX_AGE_NS = 24 * 60 * 60 * NANOSECONDS_PER_SECOND;
export const NATS_DEFAULT_DUPLICATE_WINDOW_NS = 60 * 60 * NANOSECONDS_PER_SECOND;

export function resolveDuplicateWindowNs(configured: string | undefined, maxAgeNs: number): number {
  const requested = configured === undefined ? NATS_DEFAULT_DUPLICATE_WINDOW_NS : Number(configured);
  if (!Number.isFinite(requested) || requested <= 0) return NATS_DEFAULT_DUPLICATE_WINDOW_NS;
  return Math.min(requested, maxAgeNs);
}
