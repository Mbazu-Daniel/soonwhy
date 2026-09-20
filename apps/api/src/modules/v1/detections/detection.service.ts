import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { db } from '../../../common/db';
import { findings, type DetectionEvidence } from '../../../common/db/schema/findings';
import { quickwitTenantQuery, quickwitTerm } from '../../../common/quickwit/query';
import { ProjectsRepository } from '../projects/projects.repository';
import { sanitizeRequestUrl } from './detection.utils';
import { evaluateSignal, evaluateThroughput } from './detection.engine';
import type { DetectionFinding, DetectionWindow, FindingSeverity, FindingType } from './detection.types';

const WINDOW_MS = 15 * 60_000;

interface ServiceBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
}

interface Aggregations {
  services?: { buckets?: ServiceBucket[] };
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

    return detected;
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
