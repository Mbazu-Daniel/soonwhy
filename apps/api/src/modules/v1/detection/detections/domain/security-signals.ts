import {
  AUTH_FAILURE_CRITICAL_COUNT,
  AUTH_FAILURE_GROWTH_FACTOR,
  AUTH_FAILURE_MIN_COUNT,
  SECRET_PATTERNS,
  SECRET_SAMPLE_LIMIT,
} from "./security-signals.constants";
import type { AuthFailureCount, AuthFailureSpike, LogLine, SecretExposure } from "./security-signals.types";

export function detectAuthFailureSpikes(
  current: AuthFailureCount[],
  baseline: AuthFailureCount[],
): AuthFailureSpike[] {
  const before = new Map(baseline.map((row) => [row.service, row.count]));
  return current.flatMap((row) => {
    const previous = before.get(row.service) ?? 0;
    if (row.count < AUTH_FAILURE_MIN_COUNT) return [];
    if (row.count < previous * AUTH_FAILURE_GROWTH_FACTOR) return [];
    const severity = row.count >= AUTH_FAILURE_CRITICAL_COUNT ? "critical" : "warning";
    return [{ service: row.service, count: row.count, baseline: previous, severity }];
  });
}

function redact(text: string, pattern: RegExp): string {
  const match = pattern.exec(text);
  if (!match) return "";
  const hit = match[0];
  const visible = hit.slice(0, 4);
  return text.replace(hit, `${visible}${"*".repeat(8)}`).slice(0, 160);
}

export function findSecretExposures(lines: LogLine[]): SecretExposure[] {
  const found = new Map<string, SecretExposure>();
  for (const line of lines) {
    for (const { kind, pattern } of SECRET_PATTERNS) {
      if (!pattern.test(line.message)) continue;
      const key = `${line.service}\u0000${kind}`;
      const entry = found.get(key) ?? { service: line.service, kind, count: 0, samples: [] };
      entry.count += 1;
      if (entry.samples.length < SECRET_SAMPLE_LIMIT) entry.samples.push(redact(line.message, pattern));
      found.set(key, entry);
    }
  }
  return [...found.values()];
}
