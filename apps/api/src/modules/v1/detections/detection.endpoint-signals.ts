import { QUICKWIT_INDEXES } from '@soonwhy/shared';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import { quickwitSource, quickwitTenantQuery, quickwitTerm, sanitizeRequestUrl } from '../../../common/quickwit/query';
import { evaluateEndpointPerformance } from './performance-detection';
import { WINDOW_MS, detectorThresholds, type DetectionStageContext, type DetectionStageDeps } from './detection.stage';
import type { DetectionFinding, EndpointAggregations, RequestSource } from './detection.types';

type EndpointBucket = { key: string; latency: number; errorRate: number; doc_count: number };

export async function detectEndpointSignals(
  deps: DetectionStageDeps,
  context: DetectionStageContext,
  detected: DetectionFinding[],
): Promise<void> {
  const {
    orgId, projectId, start, end, startTimestamp, endTimestamp,
    settings, detectorEnabled,
  } = context;
  const enabledEndpointPerformance = detectorEnabled('endpoint_performance');
  let currentEndpoints: Array<{ key: string; latency: number; errorRate: number; doc_count: number }> = [];
  let baselineEndpoints: Array<{ key: string; latency: number; errorRate: number; doc_count: number }> = [];

  if (enabledEndpointPerformance) {
    [currentEndpoints, baselineEndpoints] = await Promise.all([
      cachedEndpointBuckets(deps, orgId, projectId, startTimestamp, endTimestamp),
      cachedEndpointBuckets(deps, 
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);
  }

  const baselineByEndpoint = new Map(
    baselineEndpoints.map((endpoint) => [
      endpoint.key,
      endpoint,
    ]),
  );

  for (const endpoint of currentEndpoints) {
    const baseline = baselineByEndpoint.get(endpoint.key);
    const [serviceName, method, url] = endpoint.key.split('|');
    if (!serviceName || !method || !url) continue;

    const performance = evaluateEndpointPerformance(
      {
        serviceName,
        endpointName: method + ' ' + sanitizeRequestUrl(url),
        sampleCount: endpoint.doc_count,
        p95Duration: endpoint.latency,
        throughputPerMinute: endpoint.doc_count / 15,
        errorRate: endpoint.errorRate,
      },
      baseline
        ? {
            serviceName,
            endpointName: method + ' ' + sanitizeRequestUrl(url),
            sampleCount: baseline.doc_count,
            p95Duration: baseline.latency,
            throughputPerMinute: baseline.doc_count / 15,
            errorRate: baseline.errorRate,
          }
        : undefined,
      detectorThresholds(deps.detectorSettings, settings, 'endpoint_performance', [
        'minSamples',
        'minBaselineSamples',
        'latencySignalMs',
        'latencyRegressionPercent',
        'throughputRegressionPercent',
        'errorRegressionPercent',
        'errorRegressionDelta',
      ]),
    );

    if (!performance) continue;

    const endpointEvidence = {
      kind: 'request' as const,
      label: 'performance-endpoint',
      value: performance.identity.fingerprint,
      context: {
        service: serviceName,
        endpointName: performance.endpointName,
        fingerprint: performance.identity.fingerprint,
        signals: performance.signals.join(','),
        latencyRegressionPercent: performance.latencyRegressionPercent ?? null,
        throughputRegressionPercent: performance.throughputRegressionPercent ?? null,
        errorRegressionPercent: performance.errorRegressionPercent ?? null,
      },
    };

    if (performance.signals.some((signal) => signal === 'latency' || signal === 'latency_regression')) {
      detected.push(await deps.persist({
        orgId,
        projectId,
        serviceName,
        detector: 'endpoint_performance',
        type: 'latency',
        severity: performance.confidence === 'high' ? 'critical' : 'warning',
        title: 'Endpoint latency detected in ' + serviceName,
        description: performance.summary,
        observedValue: endpoint.latency,
        threshold: 100,
        unit: 'ms',
        start,
        end,
        evidence: [
          endpointEvidence,
          ...(await endpointPerformanceEvidence(deps, 
            orgId,
            projectId,
            serviceName,
            method,
            url,
            startTimestamp,
            endTimestamp,
          )),
        ],
      }));
    }

    if (performance.signals.includes('throughput_regression')) {
      detected.push(await deps.persist({
        orgId,
        projectId,
        serviceName,
        detector: 'endpoint_performance',
        type: 'throughput',
        severity: performance.confidence === 'high' ? 'critical' : 'warning',
        title: 'Endpoint throughput degradation in ' + serviceName,
        description: performance.summary,
        observedValue: endpoint.doc_count,
        threshold: baseline?.doc_count ?? endpoint.doc_count,
        unit: 'requests',
        start,
        end,
        evidence: [endpointEvidence],
      }));
    }

    if (performance.signals.includes('error_regression')) {
      detected.push(await deps.persist({
        orgId,
        projectId,
        serviceName,
        detector: 'endpoint_performance',
        type: 'error_rate',
        severity: performance.confidence === 'high' ? 'critical' : 'warning',
        title: 'Endpoint error-rate regression in ' + serviceName,
        description: performance.summary,
        observedValue: endpoint.errorRate,
        threshold: baseline?.errorRate ?? endpoint.errorRate,
        unit: '%',
        start,
        end,
        evidence: [endpointEvidence],
      }));
    }
  }}

async function cachedEndpointBuckets(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<EndpointBucket[]> {
  return deps.cachedQuery('endpoint-buckets', orgId, projectId, startTimestamp, endTimestamp, async () => {
  const result = await deps.quickwit.search<never>(QUICKWIT_INDEXES.requests, {
    query: quickwitTenantQuery(orgId, projectId),
    startTimestamp,
    endTimestamp,
    maxHits: 0,
    aggregations: {
      services: {
        terms: {
          field: 'service',
          size: 100,
          order: { _count: 'desc' },
        },
        aggs: {
          endpoints: {
            terms: {
              field: 'url',
              size: 100,
              order: { _count: 'desc' },
            },
            aggs: {
              methods: {
                terms: {
                  field: 'method',
                  size: 20,
                  order: { _key: 'asc' },
                },
                aggs: {
                  latency: {
                    percentiles: {
                      field: 'duration',
                      percents: [95],
                    },
                  },
                  errors: {
                    filter: {
                      query: 'statusCode:[500 TO 599]',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const aggregation = ((result as unknown as { aggregations?: unknown }).aggregations as EndpointAggregations | undefined)?.services;
  return (aggregation?.buckets ?? []).flatMap((serviceBucket) =>
    (serviceBucket.endpoints?.buckets ?? []).flatMap((endpointBucket) =>
      endpointBucket.methods?.buckets?.flatMap((methodBucket) => {
        const latency = methodBucket.latency?.values?.['95.0'] ?? 0;
        const errors = methodBucket.errors?.doc_count ?? 0;
        if (!methodBucket.key || latency <= 0) return [];

        return [{
          key: serviceBucket.key + '|' + methodBucket.key + '|' + endpointBucket.key,
          latency,
          errorRate: methodBucket.doc_count ? errors / methodBucket.doc_count : 0,
          doc_count: methodBucket.doc_count,
        }];
      }) ?? [],
    ),
  );
  });
}

async function endpointPerformanceEvidence(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  serviceName: string,
  method: string,
  url: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DetectionEvidence[]> {
  const query = quickwitTenantQuery(
    orgId,
    projectId,
    [
      quickwitTerm('service', serviceName),
      quickwitTerm('method', method),
      quickwitTerm('url', url),
    ].join(' AND '),
  );

  const result = await deps.quickwit.search<RequestSource>(QUICKWIT_INDEXES.requests, {
    query,
    startTimestamp,
    endTimestamp,
    maxHits: 5,
    sortBy: ['duration:desc'],
  });

  return (result.hits ?? []).flatMap((hit) => {
    const source = quickwitSource<RequestSource>(hit);
    if (!source?.traceId) return [];

    return [{
      kind: 'trace' as const,
      label: 'endpoint-trace',
      value: source.traceId,
      context: {
        traceId: source.traceId,
        service: String(source.service ?? serviceName),
        method: String(source.method ?? method),
        path: sanitizeRequestUrl(String(source.url ?? url)),
        timestamp: String(source.timestamp ?? ''),
      },
    }];
  });
}
