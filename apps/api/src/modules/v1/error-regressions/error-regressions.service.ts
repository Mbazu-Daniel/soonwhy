import { Injectable, Logger } from "@nestjs/common";
import { errorRegressions } from "../../../common/db/schema";
import { db } from "../../../common/db";
import { eq, and, gt, lt, desc } from "drizzle-orm";

@Injectable()
export class ErrorRegressionsService {
  private readonly logger = new Logger(ErrorRegressionsService.name);

  async recordError(data: {
    orgId: string;
    projectId: string;
    fingerprint: string;
    errorMessage: string;
    stackTrace?: string;
    serviceName?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await db
      .select()
      .from(errorRegressions)
      .where(
        and(
          eq(errorRegressions.fingerprint, data.fingerprint),
          eq(errorRegressions.orgId, data.orgId),
          eq(errorRegressions.projectId, data.projectId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const record = existing[0];
      
      if (!record) {
        const [created] = await db
          .insert(errorRegressions)
          .values({
            ...data,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            occurrenceCount: 1,
            regressionCount: 0,
          })
          .returning();

        return created;
      }
      
      const isRegression = record.lastResolvedAt !== null;
      
      const [updated] = await db
        .update(errorRegressions)
        .set({
          lastSeenAt: new Date(),
          occurrenceCount: (record.occurrenceCount || 0) + 1,
          isRegression,
          lastRegressionAt: isRegression ? new Date() : record.lastRegressionAt,
          regressionCount: isRegression ? (record.regressionCount || 0) + 1 : (record.regressionCount || 0),
          regressionNotified: false,
          updatedAt: new Date(),
        })
        .where(eq(errorRegressions.id, record.id))
        .returning();

      if (isRegression) {
        this.logger.warn(
          `Regression detected for error fingerprint ${data.fingerprint} in ${data.orgId}/${data.projectId}`,
        );
      }

      return updated;
    }

    const [created] = await db
      .insert(errorRegressions)
      .values({
        ...data,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        occurrenceCount: 1,
        regressionCount: 0,
      })
      .returning();

    return created;
  }

  async markAsResolved(fingerprint: string, resolvedBy: string) {
    const [updated] = await db
      .update(errorRegressions)
      .set({
        lastResolvedAt: new Date(),
        resolvedBy,
        isRegression: false,
        updatedAt: new Date(),
      })
      .where(eq(errorRegressions.fingerprint, fingerprint))
      .returning();

    return updated;
  }

  async getRegressions(
    orgId: string,
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return db
      .select()
      .from(errorRegressions)
      .where(
        and(
          eq(errorRegressions.orgId, orgId),
          eq(errorRegressions.projectId, projectId),
          eq(errorRegressions.isRegression, true),
        ),
      )
      .orderBy(desc(errorRegressions.lastRegressionAt))
      .limit(limit)
      .offset(offset);
  }

  async getRecentErrors(
    orgId: string,
    projectId: string,
    hoursAgo: number = 24,
    limit: number = 100,
  ) {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    return db
      .select()
      .from(errorRegressions)
      .where(
        and(
          eq(errorRegressions.orgId, orgId),
          eq(errorRegressions.projectId, projectId),
          gt(errorRegressions.lastSeenAt, cutoff),
        ),
      )
      .orderBy(desc(errorRegressions.lastSeenAt))
      .limit(limit);
  }

  async markRegressionNotified(id: number) {
    await db
      .update(errorRegressions)
      .set({ regressionNotified: true })
      .where(eq(errorRegressions.id, id));
  }
}
