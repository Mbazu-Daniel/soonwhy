import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { db } from '../../../common/db';
import { findings, type DetectionEvidence } from '../../../common/db/schema/findings';
import { quickwitTenantQuery, quickwitTerm } from '../../../common/quickwit/query';
import { ProjectsRepository } from '../projects/projects.repository';
import { sanitizeRequestUrl } from './detection.utils';
import { correlateFindings } from './detection.correlation';
import { completeDetectionRun, failDetectionRun, startDetectionRun } from './detection.run';
import { evaluateSignal, evaluateThroughput, evaluateTraceSpan } from './detection.engine';
import { evaluateEndpointPerformance } from './performance-detection';
import type { DetectionFinding, DetectionWindow, FindingSeverity, FindingType } from './detection.types';

const WINDOW_MS = 15 * 60_000;

interface ServiceBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
}

interface EndpointBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
  methods?: { buckets?: EndpointMethodBucket[] };
}

interface EndpointMethodBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
}

interface EndpointServiceBucket {
  key: string;
  endpoints?: { buckets?: EndpointBucket[] };
}

interface EndpointAggregations {
  services?: { buckets?: EndpointServiceBucket[] };
}

interface DependencyBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  dependencyType?: { buckets?: Array<{ key: string; doc_count: number }> };
}

interface DependencyServiceBucket {
  key: string;
  dependencies?: { buckets?: DependencyBucket[] };
}

interface Aggregations {
  services?: { buckets?: ServiceBucket[] };
  dependencies?: { buckets?: DependencyServiceBucket[] };
}

interface RequestSource {
  timestamp?: string;
  service?: string;
  method?: string;
  url?: string;
  duration?: number;
  statusCode?: number;
  traceId?: string;
}

interface TraceSource {
  timestamp?: string;
  service?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  duration?: number;
  dependencyName?: string;
  dependencyType?: string;
  spanKind?: number;
  attributes?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class DetectionService {
  constructor(
    private readonly quickwit: QuickwitService,
    private readonly projectsRepository: ProjectsRepository,
  ) {}

  async run(orgId: string, projectId: string): Promise<DetectionFinding[]> {
    await this.assertProjectAccess(orgId, projectId);
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_MS);
    const run = await startDetectionRun(orgId, projectId, start, end);

    try {
      const findings = await this.executeDetection(orgId, projectId, start, end);
      await completeDetectionRun(run.id, findings.length);
      return findings;
    } catch (error) {
      await failDetectionRun(run.id, error instanceof Error ? error.message : 'Detection failed');
      throw error;
    }
  }

  private async executeDetection(orgId: string, projectId: string, start: Date, end: Date): Promise<DetectionFinding[]> {
    await this.assertProjectAccess(orgId, projectId);

    const startTimestamp = Math.floor(start.getTime() / 1000);
    const endTimestamp = Math.floor(end.getTime() / 1000);

    const [currentBuckets, baselineBuckets] = await Promise.all([
      this.searchServiceBuckets(orgId, projectId, startTimestamp, endTimestamp),
      this.searchServiceBuckets(
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);
    const baselineByService = new Map(
      baselineBuckets.map((bucket) => [
        bucket.key,
        {
          latency: this.getLatency(bucket),
          errorRate: this.getErrorRate(bucket),
          requests: bucket.doc_count,
          samples: bucket.doc_count,
        },
      ]),
    );
    const detected: DetectionFinding[] = [];

    for (const bucket of currentBuckets) {
      const p95 = this.getLatency(bucket);
      const errorRate = this.getErrorRate(bucket);
      const baseline = baselineByService.get(bucket.key);

      const latencySignal = evaluateSignal(
        'latency',
        p95,
        baseline
          ? { value: baseline.latency, samples: baseline.samples }
          : undefined,
      );
      if (latencySignal) {
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName: bucket.key,
          type: latencySignal.type,
          severity: latencySignal.severity,
          title: 'High latency detected in ' + bucket.key,
          description: this.describeSignal('The 95th percentile request latency is ' + Math.round(p95) + 'ms over the last 15 minutes.', latencySignal),
          observedValue: latencySignal.observedValue,
          threshold: latencySignal.threshold,
          unit: latencySignal.unit,
          start,
          end,
          evidence: await this.requestEvidence(orgId, projectId, bucket.key, startTimestamp, endTimestamp, 'latency'),
        }));
      }

      const errorSignal = evaluateSignal(
        'error_rate',
        errorRate,
        baseline
          ? { value: baseline.errorRate, samples: baseline.samples }
          : undefined,
      );
      if (errorSignal) {
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName: bucket.key,
          type: errorSignal.type,
          severity: errorSignal.severity,
          title: 'Elevated error rate in ' + bucket.key,
          description: this.describeSignal('HTTP 5xx responses account for ' + errorRate.toFixed(2) + '% of requests over the last 15 minutes.', errorSignal),
          observedValue: errorSignal.observedValue,
          threshold: errorSignal.threshold,
          unit: errorSignal.unit,
          start,
          end,
          evidence: await this.requestEvidence(orgId, projectId, bucket.key, startTimestamp, endTimestamp, 'error_rate'),
        }));
      }

      const throughputSignal = evaluateThroughput(
        bucket.doc_count,
        baseline
          ? { value: baseline.requests, samples: baseline.requests }
          : undefined,
      );
      if (throughputSignal) {
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName: bucket.key,
          type: throughputSignal.type,
          severity: throughputSignal.severity,
          title: 'Throughput degradation detected in ' + bucket.key,
          description: this.describeThroughputSignal(throughputSignal),
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
                baselineRequests: throughputSignal.baselineValue,
                changePercent: throughputSignal.changePercent,
              },
            },
          ],
        }));
      }
    }

    const [currentEndpoints, baselineEndpoints] = await Promise.all([
      this.searchEndpointBuckets(orgId, projectId, startTimestamp, endTimestamp),
      this.searchEndpointBuckets(
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);

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
          signals: performance.signals,
          latencyRegressionPercent: performance.latencyRegressionPercent ?? null,
          throughputRegressionPercent: performance.throughputRegressionPercent ?? null,
          errorRegressionPercent: performance.errorRegressionPercent ?? null,
        },
      };

      if (performance.signals.some((signal) => signal === 'latency' || signal === 'latency_regression')) {
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName,
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
            ...(await this.endpointPerformanceEvidence(
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
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName,
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
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName,
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
    }

    const [currentDependencies, baselineDependencies] = await Promise.all([
      this.searchDependencyBuckets(orgId, projectId, startTimestamp, endTimestamp),
      this.searchDependencyBuckets(
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ]);

    const baselineByDependency = new Map(
      baselineDependencies.map((dependency) => [
        dependency.key,
        dependency,
      ]),
    );

    for (const dependency of currentDependencies) {
      const baseline = baselineByDependency.get(dependency.key);
      const signal = evaluateSignal(
        'dependency_latency',
        dependency.latency,
        baseline
          ? { value: baseline.latency, samples: baseline.samples }
          : undefined,
      );

      if (!signal) continue;

      const [serviceName, dependencyType, dependencyName] = dependency.key.split('|');
      if (!serviceName || !dependencyType || !dependencyName) continue;

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName,
        type: signal.type,
        severity: signal.severity,
        title: 'Slow ' + dependencyType + ' dependency in ' + serviceName,
        description: this.describeSignal(
          dependencyType + ' dependency ' + dependencyName + ' has a 95th percentile latency of ' + Math.round(dependency.latency) + 'ms.',
          signal,
        ),
        observedValue: signal.observedValue,
        threshold: signal.threshold,
        unit: signal.unit,
        start,
        end,
        evidence: [
          ...(await this.dependencyEvidence(
            orgId,
            projectId,
            serviceName,
            dependencyType,
            dependencyName,
            startTimestamp,
            endTimestamp,
          )),
          {
            kind: 'recommendation',
            label: 'optimization-guidance',
            value: this.dependencyRecommendation(dependencyType),
            context: {
              dependencyType,
              dependencyName,
              observedLatencyMs: Math.round(dependency.latency),
            },
          },
        ],
      }));
    }

    const traceSpans = await this.searchTraceSpanCandidates(
      orgId,
      projectId,
      startTimestamp,
      endTimestamp,
    );

    for (const candidate of traceSpans) {
      const signal = evaluateTraceSpan(candidate.spanDuration, candidate.traceDuration);
      if (!signal) continue;

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: candidate.serviceName,
        type: signal.type,
        severity: signal.severity,
        title: 'Span dominates trace latency in ' + candidate.serviceName,
        description:
          candidate.spanName +
          ' accounts for ' +
          signal.observedValue.toFixed(0) +
          '% of the trace duration.',
        observedValue: signal.observedValue,
        threshold: signal.threshold,
        unit: signal.unit,
        start,
        end,
        evidence: [
          {
            kind: 'trace',
            label: 'dominant-span',
            value: candidate.spanDuration,
            context: {
              traceId: candidate.traceId,
              spanId: candidate.spanId,
              spanName: candidate.spanName,
              traceDurationMs: candidate.traceDuration,
              contributionPercent: signal.observedValue,
            },
          },
        ],
      }));
    }

    const correlated = correlateFindings(detected);

    for (const bottleneck of correlated) {
      const dependencyDescription = bottleneck.dependencyName
        ? ' The correlated dependency is ' + bottleneck.dependencyName + '.'
        : '';
      const supportingTypes = bottleneck.supportingFindings
        .map((finding) => finding.type)
        .filter((type, index, types) => types.indexOf(type) === index)
        .join(', ');

      detected.push(await this.persistFinding({
        orgId,
        projectId,
        serviceName: bottleneck.serviceName,
        type: 'bottleneck',
        severity: bottleneck.supportingFindings.some((finding) => finding.severity === 'critical')
          ? 'critical'
          : bottleneck.latency.severity,
        title: 'Correlated bottleneck in ' + bottleneck.serviceName,
        description:
          'Request latency is correlated with ' +
          supportingTypes +
          '.' +
          dependencyDescription +
          ' The evidence points to the dependency or operation captured in the trace rather than the API boundary alone.',
        observedValue: bottleneck.latency.observedValue,
        threshold: bottleneck.latency.threshold,
        unit: bottleneck.latency.unit,
        start,
        end,
        evidence: [
          {
            kind: 'metric',
            label: 'correlated-signal',
            value: bottleneck.latency.observedValue,
            context: {
              service: bottleneck.serviceName,
              sourceFindingId: bottleneck.latency.id,
              sourceFindingType: bottleneck.latency.type,
            },
          },
          ...bottleneck.supportingFindings.map((finding) => ({
            kind: 'metric' as const,
            label: 'supporting-finding',
            value: finding.observedValue,
            context: {
              findingId: finding.id,
              findingType: finding.type,
              severity: finding.severity,
              service: finding.serviceName,
            },
          })),
          ...bottleneck.traceIds.map((traceId) => ({
            kind: 'trace' as const,
            label: 'correlated-trace',
            value: traceId,
            context: {
              traceId,
              service: bottleneck.serviceName,
            },
          })),
          {
            kind: 'recommendation',
            label: 'optimization-guidance',
            value: bottleneck.recommendation,
            context: {
              dependencyType: bottleneck.dependencyType ?? null,
              dependencyName: bottleneck.dependencyName ?? null,
              source: 'deterministic-correlation',
            },
          },
        ],
      }));
    }

    return detected;
  }

  async createFindingFromError(
    orgId: string,
    projectId: string,
    input: { fingerprint: string; service?: string },
  ): Promise<DetectionFinding> {
    await this.assertProjectAccess(orgId, projectId);

    const queryParts = [
      quickwitTenantQuery(orgId, projectId),
      quickwitTerm('fingerprint', input.fingerprint),
      input.service ? quickwitTerm('service', input.service) : '',
      'level:error',
    ].filter(Boolean);
    const result = await this.quickwit.search<RequestSource & { fingerprint?: string; message?: string; errorType?: string }>(
      QUICKWIT_INDEXES.logs,
      {
        query: queryParts.join(' AND '),
        startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
        endTimestamp: Math.floor(Date.now() / 1000),
        maxHits: 100,
        sortBy: ['-timestamp'],
      },
    );

    if (!result.hits.length) {
      throw new NotFoundException('Error group not found in telemetry');
    }

    const sources = result.hits
      .map((hit) => hit._source)
      .filter((source): source is RequestSource & { fingerprint?: string; message?: string; errorType?: string } => !!source);

    const firstTimestamp = sources
      .map((source) => new Date(String(source.timestamp ?? '')).getTime())
      .filter(Number.isFinite)
      .reduce((value, timestamp) => Math.min(value, timestamp), Date.now());

    const lastTimestamp = sources
      .map((source) => new Date(String(source.timestamp ?? '')).getTime())
      .filter(Number.isFinite)
      .reduce((value, timestamp) => Math.max(value, timestamp), Date.now());

    const serviceName = String(input.service ?? sources[0]?.service ?? 'unknown');
    const errorType = String(sources[0]?.errorType ?? 'Error');
    const message = String(sources[0]?.message ?? input.fingerprint);
    const traceIds = [...new Set(sources.map((source) => source.traceId).filter((id): id is string => !!id))].slice(0, 20);

    const existing = await db
      .select()
      .from(findings)
      .where(and(
        eq(findings.orgId, orgId),
        eq(findings.projectId, projectId),
        eq(findings.type, 'error_group'),
        eq(findings.serviceName, serviceName),
        eq(findings.title, 'Error group: ' + message),
      ))
      .limit(1);

    if (existing[0]) return this.toDetectionFinding(existing[0]);

    return this.persistFinding({
      orgId,
      projectId,
      serviceName,
      type: 'error_group',
      severity: 'warning',
      title: 'Error group: ' + message,
      description:
        errorType +
        ' occurred ' +
        sources.length +
        ' time' +
        (sources.length === 1 ? '' : 's') +
        ' in ' +
        serviceName +
        ' during the last 24 hours.',
      observedValue: sources.length,
      threshold: 0,
      unit: ' occurrences',
      start: new Date(firstTimestamp),
      end: new Date(lastTimestamp),
      evidence: [
        {
          kind: 'log',
          label: 'error-group',
          value: message,
          context: {
            fingerprint: input.fingerprint,
            errorType,
            occurrences: sources.length,
            service: serviceName,
          },
        },
        ...traceIds.map((traceId) => ({
          kind: 'trace' as const,
          label: 'error-trace',
          value: traceId,
          context: { traceId, service: serviceName },
        })),
      ],
    });
  }

  async list(orgId: string, projectId: string, limit = 50) {
    await this.assertProjectAccess(orgId, projectId);

    return db
      .select()
      .from(findings)
      .where(and(eq(findings.orgId, orgId), eq(findings.projectId, projectId)))
      .orderBy(desc(findings.detectedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  private async searchServiceBuckets(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<ServiceBucket[]> {
    const result = await this.quickwit.search<never>(QUICKWIT_INDEXES.requests, {
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
            latency: {
              percentiles: { field: 'duration', percents: [95] },
            },
            errors: {
              filter: { query: 'statusCode:[500 TO 599]' },
            },
          },
        },
      },
    });

    return (result.aggregations as Aggregations | undefined)?.services?.buckets ?? [];
  }

  private getLatency(bucket: ServiceBucket): number {
    return bucket.latency?.values?.['95.0'] ?? 0;
  }

  private getErrorRate(bucket: ServiceBucket): number {
    const errors = bucket.errors?.doc_count ?? 0;
    return bucket.doc_count ? (errors / bucket.doc_count) * 100 : 0;
  }

  private async searchEndpointBuckets(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<Array<{ key: string; latency: number; errorRate: number; doc_count: number }>> {
    const result = await this.quickwit.search<never>(QUICKWIT_INDEXES.requests, {
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

    const aggregation = (result.aggregations as EndpointAggregations | undefined)?.services;
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
  }

  private async searchDependencyBuckets(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<Array<{ key: string; latency: number; samples: number }>> {
    const result = await this.quickwit.search<never>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(
        orgId,
        projectId,
        quickwitTerm('spanKind', '3'),
      ),
      startTimestamp,
      endTimestamp,
      maxHits: 0,
      aggregations: {
        dependencies: {
          terms: {
            field: 'service',
            size: 100,
            order: { _count: 'desc' },
          },
          aggs: {
            dependencies: {
              terms: {
                field: 'dependencyName',
                size: 100,
                order: { _count: 'desc' },
              },
              aggs: {
                latency: {
                  percentiles: { field: 'duration', percents: [95] },
                },
                dependencyType: {
                  terms: {
                    field: 'dependencyType',
                    size: 1,
                  },
                },
              },
            },
          },
        },
      },
    });

    const aggregation = (result.aggregations as Aggregations | undefined)?.dependencies;
    return (aggregation?.buckets ?? []).flatMap((serviceBucket) =>
      (serviceBucket.dependencies?.buckets ?? []).flatMap((dependencyBucket) => {
        const dependencyName = dependencyBucket.key;
        if (!dependencyName) return [];

        const dependencyType = dependencyBucket.dependencyType?.buckets?.[0]?.key;
        const latency = dependencyBucket.latency?.values?.['95.0'] ?? 0;
        if (!dependencyType || latency <= 0) return [];

        return [{
          key: serviceBucket.key + '|' + dependencyType + '|' + dependencyName,
          latency,
          samples: dependencyBucket.doc_count,
        }];
      }),
    );
  }

  private async searchTraceSpanCandidates(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<Array<{
    traceId: string;
    spanId: string;
    spanName: string;
    serviceName: string;
    spanDuration: number;
    traceDuration: number;
  }>> {
    const result = await this.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(orgId, projectId),
      startTimestamp,
      endTimestamp,
      maxHits: 5000,
      sortBy: ['-duration'],
    });

    const traces = new Map<string, {
      duration: number;
      rootService: string;
      spans: TraceSource[];
    }>();

    for (const hit of result.hits) {
      const source = hit._source;
      if (!source?.traceId) continue;

      const trace = traces.get(source.traceId) ?? {
        duration: 0,
        rootService: String(source.service ?? ''),
        spans: [],
      };
      trace.spans.push(source);

      const startMs = new Date(String(source.timestamp ?? '')).getTime();
      const duration = Number(source.duration ?? 0);
      if (Number.isFinite(startMs) && Number.isFinite(duration) && duration > 0) {
        trace.duration = Math.max(trace.duration, startMs + duration);
      }

      if (!source.parentSpanId) {
        trace.rootService = String(source.service ?? trace.rootService);
      }

      traces.set(source.traceId, trace);
    }

    return Array.from(traces.entries()).flatMap(([traceId, trace]) => {
      const starts = trace.spans
        .map((span) => new Date(String(span.timestamp ?? '')).getTime())
        .filter(Number.isFinite);
      if (!starts.length || trace.duration <= Math.min(...starts)) return [];

      const traceDuration = trace.duration - Math.min(...starts);
      const candidate = trace.spans
        .filter((span) => Number(span.duration ?? 0) > 0)
        .sort((a, b) => Number(b.duration ?? 0) - Number(a.duration ?? 0))[0];

      if (!candidate) return [];

      return [{
        traceId,
        spanId: String(candidate.spanId ?? ''),
        spanName: String(candidate.name ?? ''),
        serviceName: String(candidate.service ?? trace.rootService),
        spanDuration: Number(candidate.duration ?? 0),
        traceDuration,
      }];
    });
  }

  private dependencyRecommendation(dependencyType: string): string {
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

  private async dependencyEvidence(
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

    const result = await this.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
      query,
      startTimestamp,
      endTimestamp,
      maxHits: 5,
      sortBy: ['duration:desc'],
    });

    return result.hits.flatMap((hit) => {
      const source = hit._source;
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

  private describeSignal(
    description: string,
    signal: ReturnType<typeof evaluateSignal>,
  ): string {
    if (signal?.baselineValue === undefined || signal.changePercent === undefined) {
      return description;
    }

    return description + ' This is a ' + signal.changePercent.toFixed(0) + '% increase from the previous comparable window.';
  }

  private describeThroughputSignal(signal: ReturnType<typeof evaluateThroughput>): string {
    if (!signal) return 'Request throughput degraded over the last 15 minutes.';

    return 'Request throughput fell from an expected ' + Math.round(signal.baselineValue) + ' requests to ' + Math.round(signal.observedValue) + ' requests over the last 15 minutes (' + signal.changePercent.toFixed(0) + '%).';
  }

  private async assertProjectAccess(orgId: string, projectId: string): Promise<void> {
    const project = await this.projectsRepository.getProjectById(projectId, orgId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private async endpointPerformanceEvidence(
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

    const result = await this.quickwit.search<RequestSource>(QUICKWIT_INDEXES.requests, {
      query,
      startTimestamp,
      endTimestamp,
      maxHits: 5,
      sortBy: ['duration:desc'],
    });

    return result.hits.flatMap((hit) => {
      const source = hit._source;
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

  private async requestEvidence(
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

    const result = await this.quickwit.search<RequestSource>(QUICKWIT_INDEXES.requests, {
      query,
      startTimestamp,
      endTimestamp,
      maxHits: 5,
      sortBy: type === 'latency' ? ['duration:desc'] : ['timestamp:desc'],
    });

    return result.hits.flatMap((hit) => {
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

  private toDetectionFinding(row: typeof findings.$inferSelect): DetectionFinding {
    return {
      id: row.id,
      projectId: row.projectId,
      serviceName: row.serviceName,
      type: row.type as FindingType,
      severity: row.severity as FindingSeverity,
      title: row.title,
      description: row.description,
      observedValue: row.observedValue,
      threshold: row.threshold,
      unit: row.unit,
      window: {
        start: row.windowStart,
        end: row.windowEnd,
      },
      evidence: row.evidence,
    };
  }

  private async persistFinding(input: {
    orgId: string;
    projectId: string;
    serviceName: string;
    type: FindingType;
    severity: FindingSeverity;
    title: string;
    description: string;
    observedValue: number;
    threshold: number;
    unit: string;
    start: Date;
    end: Date;
    evidence: DetectionEvidence[];
  }): Promise<DetectionFinding> {
    const [row] = await db
      .insert(findings)
      .values({
        orgId: input.orgId,
        projectId: input.projectId,
        serviceName: input.serviceName,
        type: input.type,
        severity: input.severity,
        title: input.title,
        description: input.description,
        observedValue: input.observedValue,
        threshold: input.threshold,
        unit: input.unit,
        windowStart: input.start,
        windowEnd: input.end,
        evidence: input.evidence,
      })
      .returning();

    if (!row) throw new Error('Failed to persist detection finding');

    return {
      id: row.id,
      projectId: row.projectId,
      serviceName: row.serviceName,
      type: row.type as FindingType,
      severity: row.severity as FindingSeverity,
      title: row.title,
      description: row.description,
      observedValue: row.observedValue,
      threshold: row.threshold,
      unit: row.unit,
      window: {
        start: row.windowStart,
        end: row.windowEnd,
      } satisfies DetectionWindow,
      evidence: row.evidence,
    };
  }
}
