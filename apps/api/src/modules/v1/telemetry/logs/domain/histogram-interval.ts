import { HISTOGRAM_INTERVALS_SECONDS, HISTOGRAM_TARGET_BUCKETS } from "./logs.constants";

export function histogramInterval(fromIso: string, toIso: string): string {
  const spanSeconds = Math.max(1, (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
  const wanted = spanSeconds / HISTOGRAM_TARGET_BUCKETS;
  const seconds =
    HISTOGRAM_INTERVALS_SECONDS.find((candidate) => candidate >= wanted) ??
    HISTOGRAM_INTERVALS_SECONDS[HISTOGRAM_INTERVALS_SECONDS.length - 1]!;
  return `${seconds}s`;
}

const MAX_HISTOGRAM_DAYS = 90;

export function clampHistogramStart(fromIso: string, toIso: string): string {
  const earliest = new Date(toIso).getTime() - MAX_HISTOGRAM_DAYS * 86_400_000;
  return new Date(Math.max(new Date(fromIso).getTime(), earliest)).toISOString();
}
