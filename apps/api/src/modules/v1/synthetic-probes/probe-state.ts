export type ProbeStatus = "up" | "down" | "degraded" | "unknown";

const OPENING_FAILURES = 2;
const RECOVERY_SUCCESSES = 2;

function consecutiveMatch(statuses: string[], predicate: (status: string) => boolean): number {
  let count = 0;
  for (const status of statuses) {
    if (!predicate(status)) return count;
    count += 1;
  }
  return count;
}

export function computeProbeStatus(
  recentStatusesNewestFirst: string[],
  currentStatus: string | null,
): ProbeStatus {
  const successes = consecutiveMatch(recentStatusesNewestFirst, (status) => status === "up");
  const failures = consecutiveMatch(
    recentStatusesNewestFirst,
    (status) => status !== "up",
  );

  if (failures >= OPENING_FAILURES) return "down";
  if (successes >= RECOVERY_SUCCESSES) return "up";
  if (currentStatus === "up" || currentStatus === "down") {
    return currentStatus as ProbeStatus;
  }
  return "unknown";
}

export function isProbeStale(
  lastCheckAt: Date | string | null | undefined,
  intervalSeconds: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastCheckAt) return true;
  const intervalMs = Math.max(
    (intervalSeconds ?? 60) * 1000 * 3,
    3 * 60 * 1000,
  );
  const last = new Date(lastCheckAt).getTime();
  return Number.isNaN(last) || now.getTime() - last > intervalMs;
}
