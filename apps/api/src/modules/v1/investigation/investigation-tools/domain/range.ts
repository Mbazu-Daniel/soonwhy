const HOUR_MS = 3_600_000;

export function rangeOf(hours: number, now = Date.now()): { from: string; to: string } {
  return { from: new Date(now - hours * HOUR_MS).toISOString(), to: new Date(now).toISOString() };
}
