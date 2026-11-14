import type { ErrorOccurrence } from "./error-intelligence.types";

export function detectErrorFrequencyTrend(
  occurrences: ErrorOccurrence[],
  windowMinutes: number = 15,
): "increasing" | "decreasing" | "stable" {
  if (occurrences.length < 2) return "stable";

  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  
  const midTime = now - windowMs / 2;
  const firstHalf = occurrences.filter((o) => new Date(o.timestamp).getTime() < midTime);
  const secondHalf = occurrences.filter((o) => new Date(o.timestamp).getTime() >= midTime);

  const firstRate = firstHalf.length / (windowMs / 2);
  const secondRate = secondHalf.length / (windowMs / 2);

  if (secondRate > firstRate * 1.5) return "increasing";
  if (secondRate < firstRate * 0.5) return "decreasing";
  return "stable";
}

export function detectErrorClusters(
  occurrences: ErrorOccurrence[],
  clusterWindowMs: number = 60000,
  clusterThreshold: number = 5,
): Array<{
  errorFingerprint: string;
  startTime: string;
  endTime: string;
  count: number;
}> {
  const clusters: Array<{
    errorFingerprint: string;
    startTime: string;
    endTime: string;
    count: number;
  }> = [];

  const byFingerprint = new Map<string, ErrorOccurrence[]>();
  for (const occ of occurrences) {
    if (!byFingerprint.has(occ.errorFingerprint)) {
      byFingerprint.set(occ.errorFingerprint, []);
    }
    byFingerprint.get(occ.errorFingerprint)!.push(occ);
  }

  for (const [fingerprint, occs] of byFingerprint) {
    occs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let clusterStart: number | null = null;
    let clusterCount = 0;

    for (let i = 0; i < occs.length; i++) {
      const occ = occs[i];
      if (!occ) continue;
      const time = new Date(occ.timestamp).getTime();

      if (clusterStart === null) {
        clusterStart = time;
        clusterCount = 1;
      } else if (time - clusterStart <= clusterWindowMs) {
        clusterCount++;
      } else {
        if (clusterCount >= clusterThreshold) {
          const prevOcc = occs[i - 1];
          if (!prevOcc) continue;
          clusters.push({
            errorFingerprint: fingerprint,
            startTime: new Date(clusterStart).toISOString(),
            endTime: new Date(prevOcc.timestamp).toISOString(),
            count: clusterCount,
          });
        }
        clusterStart = time;
        clusterCount = 1;
      }
    }

    if (clusterCount >= clusterThreshold && clusterStart !== null) {
      const lastOcc = occs[occs.length - 1];
      if (lastOcc) {
        clusters.push({
          errorFingerprint: fingerprint,
          startTime: new Date(clusterStart).toISOString(),
          endTime: new Date(lastOcc.timestamp).toISOString(),
          count: clusterCount,
        });
      }
    }
  }

  return clusters;
}
