import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { deployments, findings, services } from "../../../../../common/db/schema";
import type { FindingStatus } from "../../../../../common/db/schema/finding-lifecycle";
import { REPORT_ROW_LIMIT } from "../domain/finding-report.constants";
import type { ReportRow } from "../domain/finding-report.types";
import type { FindingListQuery, FindingSummaryRow } from "../domain/finding.types";

export class FindingRepository {
  list(orgId: string, projectId: string, query: FindingListQuery) {
    return db
      .select()
      .from(findings)
      .where(
        and(
          eq(findings.orgId, orgId),
          eq(findings.projectId, projectId),
          query.status ? eq(findings.status, query.status) : undefined,
          query.category ? eq(findings.category, query.category) : undefined,
          query.severity ? eq(findings.severity, query.severity) : undefined,
        ),
      )
      .orderBy(desc(findings.lastSeenAt))
      .limit(query.limit)
      .offset(query.offset);
  }

  async find(orgId: string, projectId: string, id: string) {
    const [row] = await db
      .select()
      .from(findings)
      .where(and(eq(findings.id, id), eq(findings.orgId, orgId), eq(findings.projectId, projectId)))
      .limit(1);
    return row;
  }

  async latestDeployBefore(projectId: string, serviceName: string, at: Date, windowMs: number) {
    const [row] = await db
      .select({ version: deployments.version, commitSha: deployments.commitSha, deployedAt: deployments.deployedAt })
      .from(deployments)
      .innerJoin(services, eq(services.id, deployments.serviceId))
      .where(
        and(
          eq(services.projectId, projectId),
          eq(services.name, serviceName),
          lte(deployments.deployedAt, at),
          gte(deployments.deployedAt, new Date(at.getTime() - windowMs)),
        ),
      )
      .orderBy(desc(deployments.deployedAt))
      .limit(1);
    return row;
  }

  async setStatus(orgId: string, projectId: string, id: string, status: FindingStatus, userId: string | null) {
    const resolved = status === "resolved";
    const [row] = await db
      .update(findings)
      .set({
        status,
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? userId : null,
      })
      .where(and(eq(findings.id, id), eq(findings.orgId, orgId), eq(findings.projectId, projectId)))
      .returning();
    return row;
  }

  summary(orgId: string, projectId: string): Promise<FindingSummaryRow[]> {
    return db
      .select({
        category: findings.category,
        status: findings.status,
        severity: findings.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(findings)
      .where(and(eq(findings.orgId, orgId), eq(findings.projectId, projectId)))
      .groupBy(findings.category, findings.status, findings.severity);
  }

  reportRows(orgId: string, projectId: string, from: Date): Promise<ReportRow[]> {
    return db
      .select({
        id: findings.id,
        title: findings.title,
        serviceName: findings.serviceName,
        category: findings.category,
        severity: findings.severity,
        status: findings.status,
        occurrences: findings.occurrences,
        detectedAt: findings.detectedAt,
        lastSeenAt: findings.lastSeenAt,
        resolvedAt: findings.resolvedAt,
        recommendation: findings.recommendation,
      })
      .from(findings)
      .where(
        and(
          eq(findings.orgId, orgId),
          eq(findings.projectId, projectId),
          or(
            inArray(findings.status, ["open", "ignored"]),
            gte(findings.resolvedAt, from),
            gte(findings.detectedAt, from),
          ),
        ),
      )
      .limit(REPORT_ROW_LIMIT);
  }
}
