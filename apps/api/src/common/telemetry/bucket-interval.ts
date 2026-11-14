const INTERVALS_SECONDS = [10, 30, 60, 300, 600, 1800, 3600, 10_800, 21_600, 43_200, 86_400];
const TARGET_BUCKETS = 60;

export function bucketInterval(fromIso: string, toIso: string): string {
  const spanSeconds = Math.max(1, (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
  const wanted = spanSeconds / TARGET_BUCKETS;
  const seconds = INTERVALS_SECONDS.find((candidate) => candidate >= wanted) ?? INTERVALS_SECONDS[INTERVALS_SECONDS.length - 1]!;
  return `${seconds}s`;
}
