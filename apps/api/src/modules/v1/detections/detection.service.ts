import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { db } from '../../../common/db';
import { findings, type DetectionEvidence } from '../../../common/db/schema/findings';
import { quickwitTenantQuery } from '../../../common/quickwit/query';
import type { DetectionFinding, DetectionWindow, FindingSeverity, FindingType } from './detection.types';

const WINDOW_MS = 15 * 60_000;
const LATENCY_THRESHOLD_MS = 1_000;
const ERROR_RATE_THRESHOLD = 5;

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
  constructor(private readonly quickwit: QuickwitService) {}

  async run(orgId: string, projectId: string): Promise<DetectionFinding[]> {
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_MS);
    const startTimestamp = Math.floor(start.getTime() / 1000);
    const endTimestamp = Math.floor(end.getTime() / 1000);

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

    const buckets = (result.aggregations as Aggregations | undefined)?.services?.buckets ?? [];
    const detected: DetectionFinding[] = [];

    for (const bucket of buckets) {
      const p95 = bucket.latency?.values?.['95.0'] ?? 0;
      const total = bucket.doc_count;
      const errors = bucket.errors?.doc_count ?? 0;
      const errorRate = total ? (errors / total) * 100 : 0;

      if (p95 >= LATENCY_THRESHOLD_MS) {
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName: bucket.key,
          type: 'latency',
          severity: p95 >= LATENCY_THRESHOLD_MS * 2 ? 'critical' : 'warning',
          title: 'High latency detected in ' + bucket.key,
          description: 'The 95th percentile request latency is ' + Math.round(p95) + 'ms over the last 15 minutes.',
          observedValue: p95,
          threshold: LATENCY_THRESHOLD_MS,
          unit: 'ms',
          start,
          end,
          evidence: await this.requestEvidence(orgId, projectId, bucket.key, startTimestamp, endTimestamp, 'latency'),
        }));
      }

      if (errorRate >= ERROR_RATE_THRESHOLD) {
        detected.push(await this.persistFinding({
          orgId,
          projectId,
          serviceName: bucket.key,
          type: 'error_rate',
          severity: errorRate >= ERROR_RATE_THRESHOLD * 2 ? 'critical' : 'warning',
          title: 'Elevated error rate in ' + bucket.key,
          description: 'HTTP 5xx responses account for ' + errorRate.toFixed(2) + '% of requests over the last 15 minutes.',
          observedValue: errorRate,
          threshold: ERROR_RATE_THRESHOLD,
          unit: '%',
          start,
          end,
          evidence: await this.requestEvidence(orgId, projectId, bucket.key, startTimestamp, endTimestamp, 'error_rate'),
        }));
      }
    }

    return detected;
  }

  async list(orgId: string, projectId: string, limit = 50) {
    return db
      .select()
      .from(findings)
      .where(and(eq(findings.orgId, orgId), eq(findings.projectId, projectId)))
      .orderBy(desc(findings.detectedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
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
    const service = 'service:"' + serviceName + '"';
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
          url: String(source.url ?? ''),
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
