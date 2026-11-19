import { CLEANUP_INTERVAL_HOURS } from "./retention.constants";

export function isCleanupDue(
  lastCleanupAt: Date | null,
  schedule: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastCleanupAt) return true;

  const intervalHours = CLEANUP_INTERVAL_HOURS[schedule ?? "daily"] ?? 24;
  const elapsedHours = (now.getTime() - lastCleanupAt.getTime()) / (60 * 60 * 1_000);

  return elapsedHours >= intervalHours;
}

export function retentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1_000);
}
