import { fingerprintQuery } from "./query-fingerprint";
import { percentile } from './percentile';

export interface DatabaseLatencyContributionTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  traceDuration: number;
  dependencyType: string;
  dependencyName: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
}

export interface DatabaseLatencyContributionThresholds {
  minimumSamples: number;
  minimumP95ContributionPercent: number;
  minimumP95DurationMs: number;
}

export interface DatabaseLatencyContributionSignal {
  sampleCount: number;
  p50ContributionPercent: number;
  p95ContributionPercent: number;
  p95DurationMs: number;
}

export interface DatabaseLatencyContributionCandidate {
  serviceName: string;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: DatabaseLatencyContributionSignal;
  samples: DatabaseLatencyContributionTrace[];
}

const DEFAULT_DATABASE_LATENCY_CONTRIBUTION_THRESHOLDS: DatabaseLatencyContributionThresholds =
  {
    minimumSamples: 10,
    minimumP95ContributionPercent: 50,
    minimumP95DurationMs: 100,
  };

export function detectDatabaseLatencyContribution(
  traces: DatabaseLatencyContributionTrace[],
  thresholds: DatabaseLatencyContributionThresholds = DEFAULT_DATABASE_LATENCY_CONTRIBUTION_THRESHOLDS,
): DatabaseLatencyContributionCandidate[] {
  const groups = new Map<string, DatabaseLatencyContributionTrace[]>();

  for (const trace of traces) {
    if (
      trace.dependencyType !== "database" ||
      !Number.isFinite(trace.duration) ||
      trace.duration <= 0 ||
      !Number.isFinite(trace.traceDuration) ||
      trace.traceDuration <= 0 ||
      trace.duration > trace.traceDuration
    )
      continue;

    const query =
      trace.dbQueryText ?? trace.dbQuerySummary ?? trace.dbOperationName;
    if (!query) continue;

    const identity = fingerprintQuery(query, trace.dbSystemName).identity;
    const key = [
      trace.service,
      identity.fingerprintVersion,
      identity.fingerprint,
      trace.dbSystemName ?? "",
    ].join("\0");

    const existing = groups.get(key) ?? [];
    existing.push(trace);
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .flatMap((samples) => {
      const first = samples[0];
      if (!first) return [];

      const contributions = samples.reduce((map, sample) => {
        const current = map.get(sample.traceId) ?? {
          duration: 0,
          traceDuration: sample.traceDuration,
          sample,
        };
        current.duration += sample.duration;
        current.traceDuration = Math.max(
          current.traceDuration,
          sample.traceDuration,
        );
        map.set(sample.traceId, current);
        return map;
      }, new Map<
        string,
        {
          duration: number;
          traceDuration: number;
          sample: DatabaseLatencyContributionTrace;
        }
      >());

      const observations = Array.from(contributions.values())
        .map((value) => ({
          ...value,
          contributionPercent: (value.duration / value.traceDuration) * 100,
        }))
        .filter((value) => Number.isFinite(value.contributionPercent));

      if (observations.length < thresholds.minimumSamples) return [];

      const contributionValues = observations.map(
        (value) => value.contributionPercent,
      );
      const durationValues = observations.map((value) => value.duration);
      const p50ContributionPercent = percentile(contributionValues, 0.5) ?? 0;
      const p95ContributionPercent = percentile(contributionValues, 0.95) ?? 0;
      const p95DurationMs = percentile(durationValues, 0.95) ?? 0;

      if (
        p95ContributionPercent < thresholds.minimumP95ContributionPercent ||
        p95DurationMs < thresholds.minimumP95DurationMs
      )
        return [];

      const query =
        first.dbQueryText ?? first.dbQuerySummary ?? first.dbOperationName;
      if (!query) return [];

      return [
        {
          serviceName: first.service,
          identity: fingerprintQuery(query, first.dbSystemName).identity,
          query,
          ...(first.dbQuerySummary
            ? { querySummary: first.dbQuerySummary }
            : {}),
          ...(first.dbOperationName
            ? { queryOperation: first.dbOperationName }
            : {}),
          ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
          ...(first.dbCollectionName
            ? { collectionName: first.dbCollectionName }
            : {}),
          signal: {
            sampleCount: observations.length,
            p50ContributionPercent,
            p95ContributionPercent,
            p95DurationMs,
          },
          samples: observations
            .sort(
              (left, right) =>
                right.contributionPercent - left.contributionPercent,
            )
            .slice(0, 10)
            .map((observation) => observation.sample),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.signal.p95ContributionPercent -
        left.signal.p95ContributionPercent,
    )
    .slice(0, 100);
}

