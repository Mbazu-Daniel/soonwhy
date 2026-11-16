import { errorFingerprint, errorTypeOf, maskPiiTokens, parseAttributes } from "./error-fingerprint";
import { MAX_OCCURRENCES, MAX_TRACE_LINKS, TIMELINE_BUCKETS } from "./error.constants";
import type {
  ErrorGroup,
  ErrorLogSource,
  ErrorOccurrence,
  ErrorRange,
  ErrorTimelineBucket,
} from "./error.types";

interface GroupAccumulator {
  group: ErrorGroup;
  traces: Set<string>;
  environments: Set<string>;
}

function toOccurrence(source: ErrorLogSource): ErrorOccurrence {
  return {
    id: source.id ?? "",
    timestamp: source.timestamp ?? "",
    level: source.level ?? "error",
    message: maskPiiTokens(source.message ?? ""),
    traceId: source.traceId ?? "",
    spanId: source.spanId ?? "",
    stackTrace: maskPiiTokens(source.stackTrace ?? ""),
    attributes: parseAttributes(source.attributes),
  };
}

export function groupErrorLogs(sources: ErrorLogSource[]): ErrorGroup[] {
  const groups = new Map<string, GroupAccumulator>();
  for (const source of sources) {
    const fingerprint = errorFingerprint(source);
    const timestamp = source.timestamp ?? "";
    const existing = groups.get(fingerprint);
    if (!existing) {
      const traces = new Set<string>();
      if (source.traceId) traces.add(source.traceId);
      groups.set(fingerprint, {
        traces,
        environments: new Set(source.environment ? [source.environment] : []),
        group: {
          environments: [],
          fingerprint,
          errorMessage: maskPiiTokens(source.message ?? ""),
          errorType: errorTypeOf(source),
          service: source.service ?? "",
          level: source.level ?? "error",
          count: 1,
          traceCount: traces.size,
          firstSeen: timestamp,
          lastSeen: timestamp,
          traceId: source.traceId ?? "",
          spanId: source.spanId ?? "",
          logId: source.id ?? "",
          exception: maskPiiTokens(source.stackTrace ?? ""),
        },
      });
      continue;
    }
    const { group, traces, environments } = existing;
    if (source.environment) environments.add(source.environment);
    group.count += 1;
    if (source.traceId) traces.add(source.traceId);
    group.traceCount = traces.size;
    if (timestamp < group.firstSeen) group.firstSeen = timestamp;
    if (timestamp > group.lastSeen) {
      group.lastSeen = timestamp;
      group.errorMessage = maskPiiTokens(source.message ?? group.errorMessage);
      group.traceId = source.traceId ?? "";
      group.spanId = source.spanId ?? "";
      group.logId = source.id ?? "";
      group.exception = maskPiiTokens(source.stackTrace ?? "");
    }
  }
  return [...groups.values()]
    .map((entry) => ({ ...entry.group, environments: [...entry.environments].sort() }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export function occurrencesOf(
  sources: ErrorLogSource[],
  fingerprint: string,
  limit = MAX_OCCURRENCES,
): ErrorOccurrence[] {
  return sources
    .filter((source) => errorFingerprint(source) === fingerprint)
    .map(toOccurrence)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export function traceIdsOf(
  sources: ErrorLogSource[],
  fingerprint: string,
  limit = MAX_TRACE_LINKS,
): string[] {
  const seen = new Set<string>();
  const matching = sources
    .filter((source) => source.traceId && errorFingerprint(source) === fingerprint)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  for (const source of matching) {
    seen.add(source.traceId!);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

export function buildTimeline(
  sources: ErrorLogSource[],
  fingerprint: string,
  range: Pick<ErrorRange, "start" | "end">,
): ErrorTimelineBucket[] {
  const span = Math.max(range.end - range.start, 1);
  const size = span / TIMELINE_BUCKETS;
  const counts = Array.from({ length: TIMELINE_BUCKETS }, () => 0);
  for (const source of sources) {
    if (errorFingerprint(source) !== fingerprint) continue;
    const time = Date.parse(source.timestamp ?? "");
    if (!Number.isFinite(time)) continue;
    const index = Math.min(
      TIMELINE_BUCKETS - 1,
      Math.max(0, Math.floor((time - range.start) / size)),
    );
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts.map((count, index) => ({
    start: new Date(range.start + index * size).toISOString(),
    count,
  }));
}
