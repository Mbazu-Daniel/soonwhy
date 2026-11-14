const INTERVALS_SECONDS = [10, 30, 60, 300, 600, 1800, 3600, 10_800, 21_600, 43_200, 86_400];
const TARGET_BUCKETS = 60;

export function bucketInterval(fromIso: string, toIso: string): string {
  const spanSeconds = Math.max(1, (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
  const wanted = spanSeconds / TARGET_BUCKETS;
  const seconds = INTERVALS_SECONDS.find((candidate) => candidate >= wanted) ?? INTERVALS_SECONDS[INTERVALS_SECONDS.length - 1]!;
  return `${seconds}s`;
}

const MAX_BUCKET_RANGE_DAYS = 90;

export function clampBucketStart(fromIso: string, toIso: string): string {
  const earliest = new Date(toIso).getTime() - MAX_BUCKET_RANGE_DAYS * 86_400_000;
  return new Date(Math.max(new Date(fromIso).getTime(), earliest)).toISOString();
}
