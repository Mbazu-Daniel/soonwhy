import { QUICKWIT_INDEXES } from '@soonwhy/shared';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import { quickwitTenantQuery, quickwitTerm, sanitizeRequestUrl } from '../../../common/quickwit/query';
import { evaluateThroughput } from './detection.engine';
import { evaluateServicePerformance } from '../intelligence/service-performance.engine';
import { searchServiceBuckets } from './detection-search.methods';
import { describePerformanceSignal, describeThroughputSignal } from './detection-description.methods';
import { WINDOW_MS, detectorThresholds, type DetectionStageContext, type DetectionStageDeps } from './detection.stage';
import type { DetectionFinding, FindingType, RequestSource, ServiceBucket } from './detection.types';

export async function detectServiceSignals(
  deps: DetectionStageDeps,
  context: DetectionStageContext,
  detected: DetectionFinding[],
): Promise<void> {
  const {
    orgId, projectId, start, end, startTimestamp, endTimestamp,
    settings, detectorEnabled,
  } = context;
  const enabledServicePerformance = detectorEnabled('service_performance');
  const enabledThroughput = detectorEnabled('throughput');
  let currentBuckets: ServiceBucket[] = [];
  let baselineBuckets: ServiceBucket[] = [];

  if (enabledServicePerformance || enabledThroughput) {
    [currentBuckets, baselineBuckets] = await Promise.all([
      cachedServiceBuckets(deps, orgId, projectId, startTimestamp, endTimestamp),
      cachedServiceBuckets(deps, 
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);
  }
  const baselineByService = new Map(
    baselineBuckets.map((bucket) => [
      bucket.key,
      {
        p50: getPercentile(bucket, '50.0'),
        p95: getPercentile(bucket, '95.0'),
        p99: getPercentile(bucket, '99.0'),
        latency: getLatency(bucket),
        errorRate: getErrorRate(bucket),
        requests: bucket.doc_count,
        samples: bucket.doc_count,
      },
    ]),
  );

  for (const bucket of currentBuckets) {
    const p50 = getPercentile(bucket, '50.0');
    const p95 = getPercentile(bucket, '95.0');
    const p99 = getPercentile(bucket, '99.0');
    const errorRate = getErrorRate(bucket);
    const baseline = baselineByService.get(bucket.key);

    const performanceSignal = enabledServicePerformance
      ? evaluateServicePerformance(
        {
          serviceName: bucket.key,
          endpoint: 'service:' + bucket.key,
          sampleCount: bucket.doc_count,
          p50,
          p95,
          p99,
          errorRate: errorRate / 100,
          throughputPerMinute: bucket.doc_count / 15,
        },
        baseline
          ? {
              p50: baseline.p50,
              p95: baseline.p95,
              p99: baseline.p99,
              errorRate: baseline.errorRate / 100,
              throughputPerMinute: baseline.requests / 15,
            }
          : undefined,
        detectorThresholds(deps.detectorSettings, settings, 'service_performance', [
          'minSamples',
          'warningP95Ms',
          'criticalP95Ms',
          'warningErrorRate',
          'criticalErrorRate',
          'regressionPercent',
        ]),
      )
      : undefined;

    if (performanceSignal) {
      detected.push(await deps.persist({
        orgId,
        projectId,
        serviceName: bucket.key,
        detector: 'service_performance',
        type: 'latency',
        severity: performanceSignal.severity,
        title: 'Service performance degradation in ' + bucket.key,
        description: describePerformanceSignal(performanceSignal),
        observedValue: p95,
        threshold: 500,
        unit: 'ms',
        start,
        end,
        evidence: [
          {
            kind: 'metric',
            label: 'performance-profile',
            value: p95,
            context: {
              service: bucket.key,
              p50,
              p95,
              p99,
              errorRate,
              throughputPerMinute: bucket.doc_count / 15,
              sampleCount: bucket.doc_count,
              reasons: performanceSignal.reasons.join('; '),
              ...(performanceSignal.latency.p95ChangePercent !== undefined
                ? { p95ChangePercent: performanceSignal.latency.p95ChangePercent }
                : {}),
              ...(performanceSignal.latency.p99ChangePercent !== undefined
                ? { p99ChangePercent: performanceSignal.latency.p99ChangePercent }
                : {}),
            },
          },
          ...(await requestEvidence(deps, 
            orgId,
            projectId,
            bucket.key,
            startTimestamp,
            endTimestamp,
            'latency',
          )),
        ],
      }));
    }

    const throughputSignal = enabledThroughput
      ? evaluateThroughput(
        bucket.doc_count,
        baseline
          ? { value: baseline.requests, samples: baseline.requests }
          : undefined,
        detectorThresholds(deps.detectorSettings, settings, 'throughput', [
          'minBaselineSamples',
          'dropRatio',
          'criticalChangePercent',
        ]),
      )
      : undefined;

    if (throughputSignal) {
      detected.push(await deps.persist({
        orgId,
        projectId,
        serviceName: bucket.key,
        detector: 'throughput',
        type: throughputSignal.type,
        severity: throughputSignal.severity,
        title: 'Throughput degradation detected in ' + bucket.key,
        description: describeThroughput(throughputSignal),
        observedValue: throughputSignal.observedValue,
        threshold: throughputSignal.threshold,
        unit: throughputSignal.unit,
        start,
        end,
        evidence: [
          {
            kind: 'metric',
            label: 'throughput-regression',
            value: throughputSignal.observedValue,
            context: {
              service: bucket.key,
              baselineRequests: throughputSignal.baselineValue ?? 0,
              changePercent: throughputSignal.changePercent ?? 0,
              p50,
              p95,
              p99,
            },
          },
        ],
      }));
    }
  }
}

function getPercentile(bucket: ServiceBucket, percentile: string): number {
  const value = bucket.latency?.values?.[percentile] ?? 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function getLatency(bucket: ServiceBucket): number {
  return getPercentile(bucket, '95.0');
}

function getErrorRate(bucket: ServiceBucket): number {
  const errors = bucket.errors?.doc_count ?? 0;
  return bucket.doc_count ? (errors / bucket.doc_count) * 100 : 0;
}

function describeThroughput(signal: ReturnType<typeof evaluateThroughput>): string {
  if (!signal) return '';
  return describeThroughputSignal(signal as { baselineValue: number; observedValue: number; changePercent: number });
}

async function cachedServiceBuckets(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<ServiceBucket[]> {
  return deps.cachedQuery('service-buckets', orgId, projectId, startTimestamp, endTimestamp, () =>
    searchServiceBuckets(deps.quickwit, orgId, projectId, startTimestamp, endTimestamp),
  );
}

async function requestEvidence(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  serviceName: string,
  startTimestamp: number,
  endTimestamp: number,
  type: FindingType,
): Promise<DetectionEvidence[]> {
  const tenant = quickwitTenantQuery(orgId, projectId);
  const service = quickwitTerm('service', serviceName);
  const query = type === 'latency'
    ? tenant + ' AND ' + service
    : tenant + ' AND ' + service + ' AND statusCode:[500 TO 599]';

  const result = await deps.quickwit.search<RequestSource>(QUICKWIT_INDEXES.requests, {
    query,
    startTimestamp,
    endTimestamp,
    maxHits: 5,
    sortBy: type === 'latency' ? ['duration:desc'] : ['timestamp:desc'],
  });

  return (result.hits ?? []).flatMap((hit) => {
    const source = hit._source;
    if (!source) return [];
    return [{
      kind: 'request',
      label: type === 'latency' ? 'slow-request' : 'error-request',
      value: type === 'latency' ? Number(source.duration ?? 0) : Number(source.statusCode ?? 0),
      context: {
        service: String(source.service ?? serviceName),
        method: String(source.method ?? ''),
        path: sanitizeRequestUrl(String(source.url ?? '')),
        statusCode: Number(source.statusCode ?? 0),
        traceId: String(source.traceId ?? ''),
        timestamp: String(source.timestamp ?? ''),
      },
    }];
  });
}
