/** ClickHouse DateTime64(3) string: `YYYY-MM-DD HH:mm:ss.sss` */
export function toChDateTime(iso?: string, fallbackMs = Date.now()): string {
  const date = iso ? new Date(iso) : new Date(fallbackMs);
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

export function chRange(from?: string, to?: string, defaultWindowMs = 24 * 60 * 60 * 1000) {
  return {
    from: toChDateTime(from, Date.now() - defaultWindowMs),
    to: toChDateTime(to),
  };
}
