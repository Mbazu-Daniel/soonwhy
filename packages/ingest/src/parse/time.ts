/** Shared OTLP time helpers. */

export function nanoTimestamp(nano: string): string | null {
  try {
    const nanos = BigInt(nano);
    if (nanos <= 0n) return null;
    const ms = nanos / 1_000_000n;
    const date = new Date(Number(ms));
    if (Number.isNaN(date.getTime())) return null;
    // Preserve sub-ms digits in the fractional seconds (OTLP is nanosecond).
    const frac = String(nanos % 1_000_000_000n).padStart(9, '0');
    return `${date.toISOString().slice(0, -5)}.${frac}Z`;
  } catch {
    return null;
  }
}

export function nanoToMs(nano: string): number {
  try {
    return Number(BigInt(nano) / 1_000_000n);
  } catch {
    return 0;
  }
}
