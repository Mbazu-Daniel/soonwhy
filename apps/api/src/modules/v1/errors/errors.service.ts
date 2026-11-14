import { Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { CacheService } from "../../../common/cache/cache.service";
import { CACHE_TTL_SECONDS } from "../../../common/cache/cache.constants";
import { db } from "../../../common/db";
import { findings, type DetectionEvidence } from "../../../common/db/schema/findings";
import { services } from "../../../common/db/schema/services";
import {
  quickwitSource,
  quickwitTenantQuery,
  quickwitTerm,
} from "../../../common/quickwit/query";
import { normalizeErrorMessage } from "./error-fingerprint";
import { buildTimeline, groupErrorLogs, occurrencesOf } from "./error-groups";
import {
  DEFAULT_RANGE_MS,
  ERROR_FINDING_TYPE,
  ERROR_LOG_LEVELS,
  MAX_ERROR_HITS,
} from "./error.constants";
import type {
  ErrorGroup,
  ErrorGroupDetail,
  ErrorLogSource,
  ErrorRange,
} from "./error.types";

export interface ErrorQuery {
  from?: string;
  to?: string;
  service?: string;
}

@Injectable()
export class ErrorsService {
  constructor(
    private readonly quickwit: QuickwitService,
    private readonly cache: CacheService,
  ) {}

  async listGroups(
    orgId: string,
    projectId: string,
    query: ErrorQuery & { limit?: number } = {},
  ): Promise<ErrorGroup[]> {
    const range = this.rangeOf(query.from, query.to);
    const limit = query.limit ?? 50;
    const key = `errors:${orgId}:${projectId}:${limit}:${range.start}:${range.end}:${query.service ?? ""}`;
    return this.cache.getOrSet(key, CACHE_TTL_SECONDS.dashboardOverview, async () => {
      const sources = await this.fetchSources(orgId, projectId, range, query.service);
      return groupErrorLogs(sources).slice(0, limit);
    });
  }

  async getGroup(
    orgId: string,
    projectId: string,
    fingerprint: string,
    query: ErrorQuery = {},
  ): Promise<ErrorGroupDetail> {
    const range = this.rangeOf(query.from, query.to);
    const sources = await this.fetchSources(orgId, projectId, range, query.service);
    const group = groupErrorLogs(sources).find((item) => item.fingerprint === fingerprint);
    if (!group) throw new NotFoundException("Error group not found in this time range");
    return {
      ...group,
      occurrences: occurrencesOf(sources, fingerprint),
      timeline: buildTimeline(sources, fingerprint, range),
    };
  }

  async createFinding(
    orgId: string,
    projectId: string,
    fingerprint: string,
    query: ErrorQuery = {},
  ) {
    const group = await this.getGroup(orgId, projectId, fingerprint, query);
    const title = `${group.errorType} in ${group.service}: ${normalizeErrorMessage(group.errorMessage)}`;
    const values = {
      severity: this.severityOf(group),
      description: `${group.count} occurrences across ${group.traceCount} traces between ${group.firstSeen} and ${group.lastSeen}.`,
      observedValue: group.count,
      threshold: 1,
      unit: "occurrences",
      windowStart: new Date(group.firstSeen),
      windowEnd: new Date(group.lastSeen),
      detectedAt: new Date(),
      evidence: this.evidenceOf(group),
    };
    const [existing] = await db
      .select({ id: findings.id })
      .from(findings)
      .where(
        and(
          eq(findings.orgId, orgId),
          eq(findings.projectId, projectId),
          eq(findings.type, ERROR_FINDING_TYPE),
          eq(findings.serviceName, group.service),
          eq(findings.title, title),
        ),
      )
      .limit(1);
    if (existing) {
      const [finding] = await db
        .update(findings)
        .set(values)
        .where(eq(findings.id, existing.id))
        .returning();
      return { status: "updated" as const, finding };
    }
    const [service] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.projectId, projectId), eq(services.name, group.service)))
      .limit(1);
    const [finding] = await db
      .insert(findings)
      .values({
        orgId,
        projectId,
        serviceId: service?.id ?? null,
        serviceName: group.service,
        type: ERROR_FINDING_TYPE,
        title,
        ...values,
      })
      .returning();
    return { status: "created" as const, finding };
  }

  private rangeOf(from?: string, to?: string): ErrorRange {
    const end = to ? new Date(to).getTime() : Date.now();
    const start = from ? new Date(from).getTime() : end - DEFAULT_RANGE_MS;
    return {
      start,
      end,
      startTimestamp: Math.floor(start / 1000),
      endTimestamp: Math.floor(end / 1000),
    };
  }

  private async fetchSources(
    orgId: string,
    projectId: string,
    range: ErrorRange,
    service?: string,
  ): Promise<ErrorLogSource[]> {
    const levels = ERROR_LOG_LEVELS.map((level) => quickwitTerm("level", level)).join(" OR ");
    const filter = service ? `(${levels}) AND ${quickwitTerm("service", service)}` : levels;
    const result = await this.quickwit.search(QUICKWIT_INDEXES.logs, {
      query: quickwitTenantQuery(orgId, projectId, filter),
      startTimestamp: range.startTimestamp,
      endTimestamp: range.endTimestamp,
      maxHits: MAX_ERROR_HITS,
      sortBy: ["timestamp:desc"],
    });
    return result.hits.flatMap((hit) => {
      const source = quickwitSource<ErrorLogSource>(hit);
      return source ? [source] : [];
    });
  }

  private severityOf(group: ErrorGroup): "warning" | "critical" {
    const serverError = /^HTTP 5\d\d$/.test(group.errorType);
    return group.level === "fatal" || serverError ? "critical" : "warning";
  }

  private evidenceOf(group: ErrorGroupDetail): DetectionEvidence[] {
    const evidence: DetectionEvidence[] = [
      {
        kind: "metric",
        label: "Occurrences",
        value: group.count,
        context: {
          fingerprint: group.fingerprint,
          traceCount: group.traceCount,
          firstSeen: group.firstSeen,
          lastSeen: group.lastSeen,
        },
      },
      {
        kind: "log",
        label: "Latest occurrence",
        value: group.errorMessage,
        context: {
          logId: group.logId,
          traceId: group.traceId || null,
          spanId: group.spanId || null,
          timestamp: group.lastSeen,
        },
      },
    ];
    if (group.traceId) {
      evidence.push({
        kind: "trace",
        label: "Trace of the latest occurrence",
        value: group.traceId,
        context: { spanId: group.spanId || null },
      });
    }
    if (group.exception) {
      evidence.push({ kind: "log", label: "Stack trace", value: group.exception.slice(0, 2000) });
    }
    return evidence;
  }
}
