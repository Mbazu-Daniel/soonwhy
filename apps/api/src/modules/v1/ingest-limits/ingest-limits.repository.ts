import { Injectable } from "@nestjs/common";
import { db } from "../../../common/db";
import { ingestLimits } from "../../../common/db/schema";
import { eq, and } from "drizzle-orm";

@Injectable()
export class IngestLimitsRepository {
  async getIngestLimits(orgId: string, projectId: string) {
    const [limit] = await db
      .select()
      .from(ingestLimits)
      .where(
        and(
          eq(ingestLimits.orgId, orgId),
          eq(ingestLimits.projectId, projectId),
        ),
      );
    return limit;
  }

  async createOrUpdateIngestLimits(data: {
    orgId: string;
    projectId: string;
    maxEventsPerSecond?: number;
    maxBytesPerSecond?: number;
    backpressureEnabled?: boolean;
    backpressureStrategy?: string;
    sampleRate?: number;
    alertOnLimitExceeded?: boolean;
  }) {
    const existing = await this.getIngestLimits(data.orgId, data.projectId);

    if (existing) {
      const [updated] = await db
        .update(ingestLimits)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(ingestLimits.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(ingestLimits).values(data).returning();
    return created;
  }
}
