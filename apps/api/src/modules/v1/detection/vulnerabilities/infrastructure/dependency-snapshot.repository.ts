import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { dependencySnapshots, findings, type DependencySnapshot } from "../../../../../common/db/schema";
import { VULNERABILITY_FINDING_TYPE } from "../domain/vulnerability.constants";

export class DependencySnapshotRepository {
  async save(orgId: string, projectId: string, serviceName: string, ecosystem: string, packages: string[]) {
    const [row] = await db
      .insert(dependencySnapshots)
      .values({ orgId, projectId, serviceName, ecosystem, packages })
      .onConflictDoUpdate({
        target: [dependencySnapshots.projectId, dependencySnapshots.serviceName, dependencySnapshots.ecosystem],
        set: { packages, updatedAt: new Date(), lastScanError: null },
      })
      .returning();
    return row!;
  }

  list(orgId: string, projectId: string) {
    return db
      .select({
        id: dependencySnapshots.id,
        serviceName: dependencySnapshots.serviceName,
        ecosystem: dependencySnapshots.ecosystem,
        updatedAt: dependencySnapshots.updatedAt,
        lastScannedAt: dependencySnapshots.lastScannedAt,
        lastScanError: dependencySnapshots.lastScanError,
      })
      .from(dependencySnapshots)
      .where(and(eq(dependencySnapshots.orgId, orgId), eq(dependencySnapshots.projectId, projectId)));
  }

  dueForRescan(before: Date, limit: number): Promise<DependencySnapshot[]> {
    return db
      .select()
      .from(dependencySnapshots)
      .where(or(isNull(dependencySnapshots.lastScannedAt), lt(dependencySnapshots.lastScannedAt, before)))
      .orderBy(asc(dependencySnapshots.lastScannedAt))
      .limit(limit);
  }

  async markScanned(orgId: string, id: string, error: string | null, at: Date) {
    await db
      .update(dependencySnapshots)
      .set({ lastScannedAt: at, lastScanError: error })
      .where(and(eq(dependencySnapshots.id, id), eq(dependencySnapshots.orgId, orgId)));
  }

  openFingerprints(projectId: string, serviceName: string) {
    return db
      .select({ id: findings.id, fingerprint: findings.fingerprint })
      .from(findings)
      .where(
        and(
          eq(findings.projectId, projectId),
          eq(findings.serviceName, serviceName),
          eq(findings.type, VULNERABILITY_FINDING_TYPE),
          eq(findings.status, "open"),
        ),
      );
  }

  async resolve(orgId: string, id: string, at: Date) {
    await db
      .update(findings)
      .set({ status: "resolved", resolvedAt: at, resolvedBy: null })
      .where(and(eq(findings.id, id), eq(findings.orgId, orgId)));
  }
}
