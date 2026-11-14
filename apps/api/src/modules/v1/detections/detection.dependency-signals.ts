import { QUICKWIT_INDEXES } from '@soonwhy/shared';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import { quickwitSource, quickwitTenantQuery, quickwitTerm } from '../../../common/quickwit/query';
import { evaluateDependency } from '../intelligence/dependency-intelligence';
import { searchDependencyBuckets } from './detection-search.methods';
import { WINDOW_MS, detectorThresholds, type DetectionStageContext, type DetectionStageDeps } from './detection.stage';
import type { DetectionFinding, TraceSource } from './detection.types';

type DependencyBucket = {
  key: string;
  serviceName: string;
  dependencyType: 'database' | 'cache' | 'redis' | 'memcached' | 'queue' | 'http' | 'rpc' | 'grpc' | 'other';
  dependencyName: string;
  latency: number;
  samples: number;
  errorCount: number;
  errorRate: number;
};

export async function detectDependencySignals(
  deps: DetectionStageDeps,
  context: DetectionStageContext,
  detected: DetectionFinding[],
): Promise<void> {
  const {
    orgId, projectId, start, end, startTimestamp, endTimestamp,
    settings, detectorEnabled,
  } = context;
  const enabledDependencyLatency = detectorEnabled('dependency_latency');
  const noDependencyBuckets: DependencyBucket[] = [];
  const [currentDependencies, baselineDependencies] = enabledDependencyLatency
    ? await Promise.all([
      cachedDependencyBuckets(deps, orgId, projectId, startTimestamp, endTimestamp),
      cachedDependencyBuckets(deps, 
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ])
    : [noDependencyBuckets, noDependencyBuckets];

  const baselineByDependency = new Map(
    baselineDependencies.map((dependency) => [
      dependency.key,
      dependency,
    ]),
  );

  for (const dependency of currentDependencies) {
    const baseline = baselineByDependency.get(dependency.key);
    const { serviceName, dependencyType, dependencyName } = dependency;
    const finding = evaluateDependency({
      serviceName,
      dependencyType,
      dependencyName,
      sampleCount: dependency.samples,
      ...(baseline ? { baselineSampleCount: baseline.samples } : {}),
      p95Duration: dependency.latency,
      ...(baseline ? { baselineP95Duration: baseline.latency } : {}),
      errorCount: dependency.errorCount,
      errorRate: dependency.errorRate,
      ...(baseline ? { baselineErrorRate: baseline.errorRate } : {}),
    }, detectorThresholds(deps.detectorSettings, settings, 'dependency_latency', [
      'minSamples',
      'minBaselineSamples',
      'latencySignalMs',
      'latencyRegressionPercent',
      'errorSignalRate',
      'errorRegressionPercent',
      'errorRegressionDelta',
      'throughputRegressionPercent',
    ]));

    if (!finding) continue;

    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName,
      detector: 'dependency_latency',
      type: 'dependency_latency',
      severity: finding.confidence === 'high' ? 'critical' : 'warning',
      title: 'Dependency degradation in ' + serviceName,
      description: finding.summary,
      observedValue: dependency.latency,
      threshold: 100,
      unit: 'ms',
      start,
      end,
      evidence: [
        ...(await dependencyEvidence(deps, 
          orgId,
          projectId,
          serviceName,
          dependencyType,
          dependencyName,
          startTimestamp,
          endTimestamp,
        )),
        {
          kind: 'metric',
          label: 'dependency-profile',
          value: dependency.latency,
          context: {
            dependencyType,
            dependencyName,
            sampleCount: dependency.samples,
            errorCount: dependency.errorCount,
            errorRate: dependency.errorRate,
            ...(finding.latencyRegressionPercent !== undefined
              ? { latencyRegressionPercent: finding.latencyRegressionPercent }
              : {}),
            ...(finding.errorRegressionPercent !== undefined
              ? { errorRegressionPercent: finding.errorRegressionPercent }
              : {}),
            ...(finding.throughputRegressionPercent !== undefined
              ? { throughputRegressionPercent: finding.throughputRegressionPercent }
              : {}),
            signals: finding.signals.join(','),
            confidence: finding.confidence,
            fingerprint: finding.identity.fingerprint,
            fingerprintVersion: finding.identity.fingerprintVersion,
          },
        },
        {
          kind: 'recommendation',
          label: 'optimization-guidance',
          value: dependencyRecommendation(dependencyType),
          context: {
            dependencyType,
            dependencyName,
          },
        },
      ],
    }));
  }}

function dependencyRecommendation(dependencyType: string): string {
  switch (dependencyType) {
    case 'database':
      return 'Inspect the query shape and database plan first. Check for N+1 queries, missing indexes, excessive reads or selected fields, offset pagination, and repeated queries. Use EXPLAIN ANALYZE before changing the query or schema.';
    case 'http':
      return 'Inspect downstream latency, request payload size, retries, timeouts, and connection reuse. Avoid retry amplification and reduce unnecessary payload or downstream calls where possible.';
    case 'rpc':
      return 'Inspect downstream RPC latency, retry behavior, timeouts, connection reuse, and whether multiple calls can be batched or avoided.';
    default:
      return 'Inspect the downstream operation and trace its latency contribution before changing the caller. Check for repeated calls, unnecessary work, and connection or pooling issues.';
  }
}

async function dependencyEvidence(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  serviceName: string,
  dependencyType: string,
  dependencyName: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DetectionEvidence[]> {
  const query = quickwitTenantQuery(
    orgId,
    projectId,
    [
      quickwitTerm('service', serviceName),
      quickwitTerm('spanKind', '3'),
      quickwitTerm('dependencyType', dependencyType),
      quickwitTerm('dependencyName', dependencyName),
    ].join(' AND '),
  );

  const result = await deps.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
    query,
    startTimestamp,
    endTimestamp,
    maxHits: 5,
    sortBy: ['duration:desc'],
  });

  return (result.hits ?? []).flatMap((hit) => {
    const source = quickwitSource<TraceSource>(hit);
    if (!source) return [];

    return [{
      kind: 'trace',
      label: 'slow-dependency-span',
      value: Number(source.duration ?? 0),
      context: {
        service: String(source.service ?? serviceName),
        dependencyType,
        dependencyName,
        traceId: String(source.traceId ?? ''),
        spanId: String(source.spanId ?? ''),
        spanName: String(source.name ?? ''),
        timestamp: String(source.timestamp ?? ''),
      },
    }];
  });
}

async function cachedDependencyBuckets(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DependencyBucket[]> {
  return deps.cachedQuery('dependency-buckets', orgId, projectId, startTimestamp, endTimestamp, async () =>
    (await searchDependencyBuckets(deps.quickwit, orgId, projectId, startTimestamp, endTimestamp)) as unknown as DependencyBucket[]);
}
