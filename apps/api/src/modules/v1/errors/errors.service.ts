import { Injectable, NotFoundException } from "@nestjs/common";
import { summarizeStack } from "./stack-summary";
import { and, eq, or, sql } from "drizzle-orm";
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
import { ERROR_SPAN_FILTER, REQUEST_SPAN_FILTER } from "../../../common/telemetry/span-filters";
import { normalizeErrorMessage } from "./error-fingerprint";
import { UNRESOLVED, deriveIssueState } from "./error-issue-state";
import {
  clearIssueState,
  findIssueState,
  listIssueStates,
  saveIssueState,
} from "./error-issue-states.store";
import { mergeErrorSources } from "./error-sources";
import { buildTimeline, groupErrorLogs, occurrencesOf, traceIdsOf } from "./error-groups";
import {
  DEFAULT_RANGE_MS,
  ERROR_FINDING_TYPE,
  ERROR_LOG_LEVELS,
  HTTP_ERROR_FLOOR,
  MAX_ERROR_HITS,
} from "./error.constants";
import type {
  ErrorGroup,
  ErrorGroupDetail,
  ErrorGroupSummary,
  ErrorIssueState,
  ErrorIssueStatusInput,
  ErrorLogSource,
  ErrorRange,
  RequestErrorSource,
  SpanErrorSource,
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
  ): Promise<ErrorGroupSummary[]> {
    const range = this.rangeOf(query.from, query.to);
    const limit = query.limit ?? 50;
    const key = `errors:${orgId}:${projectId}:${limit}:${range.start}:${range.end}:${query.service ?? ""}`;
    const groups = await this.cache.getOrSet(key, CACHE_TTL_SECONDS.dashboardOverview, async () => {
      const sources = await this.fetchSources(orgId, projectId, range, query.service);
      return groupErrorLogs(sources).slice(0, limit);
    });
    const states = await listIssueStates({ orgId, projectId });
    return groups.map((group) => ({
      ...group,
      issue: deriveIssueState(states.get(group.fingerprint), group.lastSeen),
    }));
  }

  async setStatus(
    orgId: string,
    projectId: string,
    fingerprint: string,
    status: ErrorIssueStatusInput,
    userId: string | null,
  ): Promise<ErrorIssueState> {
    const scope = { orgId, projectId };
    if (status === "unresolved") {
      await clearIssueState(scope, fingerprint);
      return UNRESOLVED;
    }
    const resolvedAt = status === "resolved" ? new Date() : null;
    const row = await saveIssueState({ ...scope, fingerprint, status, resolvedAt, userId });
    return deriveIssueState(row, "");
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
      findingId: await this.findingIdOf(orgId, projectId, group),
      issue: deriveIssueState(await findIssueState({ orgId, projectId }, fingerprint), group.lastSeen),
      occurrences: occurrencesOf(sources, fingerprint),
      traceIds: traceIdsOf(sources, fingerprint),
      timeline: buildTimeline(sources, fingerprint, range),
    };
  }

  private sameGroup(group: ErrorGroup) {
    const marker = JSON.stringify([{ context: { fingerprint: group.fingerprint } }]);
    return or(
      sql`${findings.evidence} @> ${marker}::jsonb`,
      eq(findings.title, this.titleOf(group)),
    );
  }

  private titleOf(group: ErrorGroup): string {
    return `${group.errorType} in ${group.service}: ${normalizeErrorMessage(group.errorMessage)}`;
  }

  private async findingIdOf(
    orgId: string,
    projectId: string,
    group: ErrorGroup,
  ): Promise<string | null> {
    const [existing] = await db
      .select({ id: findings.id })
      .from(findings)
      .where(
        and(
          eq(findings.orgId, orgId),
          eq(findings.projectId, projectId),
          eq(findings.type, ERROR_FINDING_TYPE),
          eq(findings.serviceName, group.service),
          this.sameGroup(group),
        ),
      )
      .limit(1);
    return existing?.id ?? null;
  }

  async createFinding(
    orgId: string,
    projectId: string,
    fingerprint: string,
    query: ErrorQuery = {},
  ) {
    const group = await this.getGroup(orgId, projectId, fingerprint, query);
    const title = this.titleOf(group);
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
          this.sameGroup(group),
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
    const serviceFilter = service ? ` AND ${quickwitTerm("service", service)}` : "";
    const search = { startTimestamp: range.startTimestamp, endTimestamp: range.endTimestamp, maxHits: MAX_ERROR_HITS, sortBy: ["timestamp:desc"] };
    const optional = (promise: Promise<{ hits: unknown[] }>) =>
      promise.catch(() => ({ hits: [] as unknown[] }));
    const [logs, spans, requests] = await Promise.all([
      this.quickwit.search(QUICKWIT_INDEXES.logs, {
        ...search,
        query: quickwitTenantQuery(orgId, projectId, `(${levels})${serviceFilter}`),
      }),
      optional(
        this.quickwit.search(QUICKWIT_INDEXES.traces, {
          ...search,
          query: quickwitTenantQuery(orgId, projectId, `(${ERROR_SPAN_FILTER} OR (httpStatusCode:>=${HTTP_ERROR_FLOOR} AND ${REQUEST_SPAN_FILTER}))${serviceFilter}`),
        }),
      ),
      optional(
        this.quickwit.search(QUICKWIT_INDEXES.requests, {
          ...search,
          query: quickwitTenantQuery(orgId, projectId, `statusCode:>=${HTTP_ERROR_FLOOR}${serviceFilter}`),
        }),
      ),
    ]);
    const sourcesOf = <T,>(result: { hits: unknown[] }): T[] =>
      result.hits.flatMap((hit) => {
        const source = quickwitSource<T>(hit);
        return source ? [source] : [];
      });
    return mergeErrorSources({
      logs: sourcesOf<ErrorLogSource>(logs),
      spans: sourcesOf<SpanErrorSource>(spans),
      requests: sourcesOf<RequestErrorSource>(requests),
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
    evidence.push(...this.stackEvidenceOf(group.exception));
    return evidence;
  }

  private stackEvidenceOf(stack: string): DetectionEvidence[] {
    const summary = summarizeStack(stack);
    if (!summary) return [];
    const evidence: DetectionEvidence[] = [];
    if (summary.applicationFrames.length > 0) {
      evidence.push({
        kind: "log",
        label: "Application frames",
        value: summary.applicationFrames.join("\n"),
        context: { exception: summary.header },
      });
    }
    summary.causes.forEach((cause, index) => {
      evidence.push({
        kind: "log",
        label: `Cause ${index + 1}`,
        value: cause.header,
        context: { topFrame: cause.topFrame },
      });
    });
    return evidence;
  }
}
