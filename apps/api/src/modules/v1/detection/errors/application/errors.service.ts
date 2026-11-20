import { Injectable, NotFoundException } from "@nestjs/common";
import { summarizeStack } from "../domain/stack-summary";
import { and, eq, or, sql } from "drizzle-orm";
import { QuickwitService } from "@soonwhy/shared";
import { CacheService } from "../../../../../common/cache/cache.service";
import { CACHE_TTL_SECONDS } from "../../../../../common/cache/cache.constants";
import { db } from "../../../../../common/db";
import { findings, type DetectionEvidence } from "../../../../../common/db/schema/findings";
import { services } from "../../../../../common/db/schema/services";
import { quickwitSource, quickwitTerm } from "../../../../../common/quickwit/query";
import { ERROR_SPAN_FILTER, REQUEST_SPAN_FILTER } from "../../../../../common/telemetry/span-filters";
import { normalizeErrorMessage } from "../domain/error-fingerprint";
import { deriveIssueState } from "../domain/error-issue-state";
import { UNRESOLVED } from "../domain/error-issue-state.constants";
import { clearIssueState, findIssueState, listIssueStates, saveIssueState } from "../infrastructure/error-issue-states.store";
import { fetchTraceException } from "../domain/trace-exception";
import { isScannerProbe } from "../domain/scanner-probe";
import { isIgnoredByRules, rulesFingerprint } from "../domain/ignore-rules";
import { listIgnoreRules } from "../infrastructure/ignore-rules.store";
import { mergeErrorSources } from "../domain/error-sources";
import { buildTimeline, groupErrorLogs, occurrencesOf, traceIdsOf } from "../domain/error-groups";
import { DEFAULT_RANGE_MS, ERROR_FINDING_MIN_OCCURRENCES, ERROR_FINDING_SYNC_LIMIT, ERROR_FINDING_TYPE, ERROR_LOG_LEVELS, HTTP_ERROR_FLOOR, MAX_ERROR_HITS } from "../domain/error.constants";
import type { ErrorGroup, ErrorGroupDetail, ErrorGroupSummary, ErrorIssueState, ErrorIssueStatusInput, ErrorLogSource, ErrorRange, RequestErrorSource, SpanErrorSource } from "../domain/error.types";
import { categoryOf, recommendationFor } from "../../findings/domain/finding-kind";
import { findingFingerprint } from "../../findings/domain/finding-fingerprint";
import { recurrenceUpdate } from "../../findings/infrastructure/finding-recurrence";
import { searchTenant } from "../../../../../common/telemetry/tenant-search";
import type { ErrorQuery } from "../domain/errors.service.types";

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
    const rules = await listIgnoreRules({ orgId, projectId });
    const key = `errors:${orgId}:${projectId}:${limit}:${range.start}:${range.end}:${query.service ?? ""}:${query.includeProbes ? "all" : "real"}:${query.environment ?? ""}:${rulesFingerprint(rules)}`;
    const groups = await this.cache.getOrSet(key, CACHE_TTL_SECONDS.dashboardOverview, async () => {
      const sources = await this.fetchSources(orgId, projectId, range, query.service, query.environment);
      const grouped = groupErrorLogs(sources).map((group) => ({ ...group, scannerProbe: isScannerProbe(group) }));
      return grouped
        .filter((group) => query.includeProbes || (!group.scannerProbe && !isIgnoredByRules(group, rules)))
        .slice(0, limit);
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
    const sources = await this.fetchSources(orgId, projectId, range, query.service, query.environment);
    const group = groupErrorLogs(sources).find((item) => item.fingerprint === fingerprint);
    if (!group) throw new NotFoundException("Error group not found in this time range");
    return {
      ...group,
      traceException: await fetchTraceException(this.quickwit, { orgId, projectId }, group.traceId),
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

  async syncFindings(orgId: string, projectId: string): Promise<number> {
    const groups = await this.listGroups(orgId, projectId, { limit: ERROR_FINDING_SYNC_LIMIT });
    const eligible = groups.filter(
      (group) =>
        !group.scannerProbe &&
        group.issue.status !== "resolved" &&
        group.issue.status !== "ignored" &&
        group.count >= ERROR_FINDING_MIN_OCCURRENCES,
    );
    let created = 0;
    for (const group of eligible) {
      const { finding } = await this.createFinding(orgId, projectId, group.fingerprint);
      if (finding) created += 1;
    }
    return created;
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
      category: categoryOf(ERROR_FINDING_TYPE),
      fingerprint: findingFingerprint(ERROR_FINDING_TYPE, group.service, fingerprint),
      recommendation: recommendationFor(ERROR_FINDING_TYPE),
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
        .set({ ...values, ...recurrenceUpdate(new Date(group.lastSeen)) })
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
        lastSeenAt: new Date(group.lastSeen),
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
    environment?: string,
  ): Promise<ErrorLogSource[]> {
    const levels = ERROR_LOG_LEVELS.map((level) => quickwitTerm("level", level)).join(" OR ");
    const serviceFilter = service ? ` AND ${quickwitTerm("service", service)}` : "";
    const environmentFilter = environment ? ` AND ${quickwitTerm("environment", environment)}` : "";
    const search = { startTimestamp: range.startTimestamp, endTimestamp: range.endTimestamp, maxHits: MAX_ERROR_HITS, sortBy: ["timestamp:desc"] };
    const optional = (promise: Promise<{ hits: unknown[] }>) =>
      promise.catch(() => ({ hits: [] as unknown[] }));
    const [logs, spans, requests] = await Promise.all([
      searchTenant(this.quickwit, "logs", { orgId, projectId }, {
        ...search,
        filter: `(${levels})${serviceFilter}${environmentFilter}`,
      }),
      optional(
        searchTenant(this.quickwit, "traces", { orgId, projectId }, {
          ...search,
          filter: `(${ERROR_SPAN_FILTER} OR (httpStatusCode:>=${HTTP_ERROR_FLOOR} AND ${REQUEST_SPAN_FILTER}))${serviceFilter}${environmentFilter}`,
        }),
      ),
      optional(
        searchTenant(this.quickwit, "requests", { orgId, projectId }, {
          ...search,
          filter: `statusCode:>=${HTTP_ERROR_FLOOR}${serviceFilter}${environmentFilter}`,
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
    if (group.traceException) {
      const { type, message, stacktrace, spanName, spanId } = group.traceException;
      evidence.push({
        kind: "log",
        label: "Exception in linked trace",
        value: [type, message].filter(Boolean).join(": ").slice(0, 500),
        context: { spanId, spanName, stacktrace: stacktrace.slice(0, 2000) },
      });
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
