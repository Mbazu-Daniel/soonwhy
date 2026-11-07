import { Injectable } from "@nestjs/common";
import { db } from "../../../common/db";
import { syntheticProbes, syntheticProbeResults } from "../../../common/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

@Injectable()
export class SyntheticProbesRepository {
  async createProbe(orgId: string, projectId: string, input: any) {
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

  async getProbeById(id: number) {
    const [probe] = await db
      .select()
      .from(syntheticProbes)
      .where(eq(syntheticProbes.id, id));
    return probe;
  }

  async updateProbe(id: number, input: any) {
    const [probe] = await db
      .update(syntheticProbes)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(syntheticProbes.id, id))
      .returning();
    return probe;
  }

  async deleteProbe(id: number) {
    await db.delete(syntheticProbes).where(eq(syntheticProbes.id, id));
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

  async getProbeResults(probeId: number, limit: number = 100) {
    return db
      .select()
      .from(syntheticProbeResults)
      .where(eq(syntheticProbeResults.probeId, probeId))
      .orderBy(desc(syntheticProbeResults.checkedAt))
      .limit(limit);
  }

  async getEnabledProbes() {
    return db
      .select()
      .from(syntheticProbes)
      .where(eq(syntheticProbes.enabled, true));
  }

  async updateProbeStats(id: number, stats: {
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
      .where(eq(syntheticProbes.id, id));
  }
}
