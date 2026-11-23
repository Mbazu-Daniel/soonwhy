import { Injectable } from "@nestjs/common";
import { db } from "../../../../../common/db";
import { syntheticProbes, syntheticProbeResults } from "../../../../../common/db/schema";
import type { CreateSyntheticProbeInput, UpdateSyntheticProbeInput } from "../domain/dto";
import { eq, desc, and, lt, isNull, or, sql } from "drizzle-orm";
import type { ProbeScope } from "../domain/synthetic-probes.repository.types";

function probeWhere(scope: ProbeScope, id: number) {
  return and(
    eq(syntheticProbes.id, id),
    eq(syntheticProbes.orgId, scope.orgId),
    eq(syntheticProbes.projectId, scope.projectId),
  );
}

@Injectable()
export class SyntheticProbesRepository {
  async createProbe(orgId: string, projectId: string, input: CreateSyntheticProbeInput) {
    const [probe] = await db
      .insert(syntheticProbes)
      .values({
        orgId,
        projectId,
        name: input.name,
        url: input.url,
        method: input.method,
        headers: input.headers,
        body: input.body,
        expectedStatusCode: input.expectedStatusCode,
        timeoutMs: input.timeoutMs,
        intervalSeconds: input.intervalSeconds,
        region: input.region,
        enabled: true,
      })
      .returning();
    return probe;
  }

  async getProbes(orgId: string, projectId: string) {
    return db
      .select()
      .from(syntheticProbes)
      .where(
        and(
          eq(syntheticProbes.orgId, orgId),
          eq(syntheticProbes.projectId, projectId),
        ),
      )
      .orderBy(desc(syntheticProbes.createdAt));
  }

  async getProbeById(scope: ProbeScope, id: number) {
    const [probe] = await db
      .select()
      .from(syntheticProbes)
      .where(probeWhere(scope, id));
    return probe;
  }

  async updateProbe(scope: ProbeScope, id: number, input: UpdateSyntheticProbeInput) {
    const [probe] = await db
      .update(syntheticProbes)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(probeWhere(scope, id))
      .returning();
    return probe;
  }

  async deleteProbe(scope: ProbeScope, id: number) {
    const deleted = await db
      .delete(syntheticProbes)
      .where(probeWhere(scope, id))
      .returning({ id: syntheticProbes.id });
    return deleted.length > 0;
  }

  async createResult(probeId: number, result: {
    status: string;
    statusCode: number | null;
    responseTimeMs: number | null;
    errorMessage: string | null;
  }) {
    const [probeResult] = await db
      .insert(syntheticProbeResults)
      .values({
        probeId,
        status: result.status,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        errorMessage: result.errorMessage,
        checkedAt: new Date(),
      })
      .returning();
    return probeResult;
  }

  async getRecentResultsForProbes(probeIds: number[], limit: number = 100) {
    const byProbe = new Map<number, (typeof syntheticProbeResults.$inferSelect)[]>();
    if (probeIds.length === 0) return byProbe;
    const result = await db.execute(sql`
      select recent.id,
             recent.probe_id as "probeId",
             recent.status,
             recent.status_code as "statusCode",
             recent.response_time_ms as "responseTimeMs",
             recent.error_message as "errorMessage",
             recent.checked_at as "checkedAt"
      from unnest(${sql.raw(`ARRAY[${probeIds.map((id) => Math.trunc(Number(id))).join(",")}]::int[]`)}) as probe(id)
      cross join lateral (
        select * from synthetic_probe_results
        where probe_id = probe.id
        order by checked_at desc
        limit ${limit}
      ) as recent
      order by recent.checked_at desc
    `);
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as (typeof syntheticProbeResults.$inferSelect)[];
    for (const row of rows) {
      const list = byProbe.get(row.probeId) ?? [];
      list.push({ ...row, checkedAt: new Date(row.checkedAt as unknown as string) });
      byProbe.set(row.probeId, list);
    }
    return byProbe;
  }

  async getProbeResults(scope: ProbeScope, probeId: number, limit: number = 100) {
    const rows = await db
      .select({ result: syntheticProbeResults })
      .from(syntheticProbeResults)
      .innerJoin(syntheticProbes, eq(syntheticProbes.id, syntheticProbeResults.probeId))
      .where(probeWhere(scope, probeId))
      .orderBy(desc(syntheticProbeResults.checkedAt))
      .limit(limit);
    return rows.map((row) => row.result);
  }

  async cleanupOldResults(daysOld: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(syntheticProbeResults)
      .where(
        or(
          isNull(syntheticProbeResults.checkedAt),
          lt(syntheticProbeResults.checkedAt, cutoff),
        ),
      );
    return deleted.length;
  }

  async claimDueProbe(id: number): Promise<boolean> {
    const result = await db
      .update(syntheticProbes)
      .set({ lastCheckAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(syntheticProbes.id, id),
          eq(syntheticProbes.enabled, true),
          or(
            isNull(syntheticProbes.lastCheckAt),
            sql`${syntheticProbes.lastCheckAt} + make_interval(secs => ${syntheticProbes.intervalSeconds}) < now()`,
          ),
        ),
      )
      .returning({ id: syntheticProbes.id });
    return result.length > 0;
  }

  async getDueProbes() {
    return db
      .select()
      .from(syntheticProbes)
      .where(
        and(
          eq(syntheticProbes.enabled, true),
          or(
            isNull(syntheticProbes.lastCheckAt),
            sql`${syntheticProbes.lastCheckAt} + make_interval(secs => ${syntheticProbes.intervalSeconds}) < now()`,
          ),
        ),
      )
      .orderBy(syntheticProbes.lastCheckAt);
  }

  async updateProbeStats(scope: ProbeScope, id: number, stats: {
    lastStatus: string;
    uptimePercent: number;
    totalChecks: number;
    failedChecks: number;
    lastCheckAt: Date;
  }) {
    await db
      .update(syntheticProbes)
      .set({
        lastStatus: stats.lastStatus,
        uptimePercent: stats.uptimePercent,
        totalChecks: stats.totalChecks,
        failedChecks: stats.failedChecks,
        lastCheckAt: stats.lastCheckAt,
        updatedAt: new Date(),
      })
      .where(probeWhere(scope, id));
  }
}
