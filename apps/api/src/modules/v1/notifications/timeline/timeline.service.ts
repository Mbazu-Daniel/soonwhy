import { Injectable, Logger } from "@nestjs/common";
import { db } from "../../../../common/db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  incidentTimelineEvents,
  type TimelineEventType,
} from "../../../../common/db/schema";

type TimelineEventRecord = typeof incidentTimelineEvents.$inferSelect;

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  async addEvent(
    orgId: string,
    projectId: string,
    incidentId: string,
    event: {
      type:
        | "state_change"
        | "ownership_transfer"
        | "comment"
        | "status_update"
        | "custom";
      actorId: string;
      actorName: string;
      role?: string;
      timestamp: Date;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<TimelineEventRecord> {
    const [eventRow] = await db
      .insert(incidentTimelineEvents)
      .values({
        orgId,
        projectId,
        incidentId,
        type: event.type as TimelineEventType,
        actorId: event.actorId,
        actorName: event.actorName,
        createdAt: event.timestamp,
        message: event.message,
        metadata: event.metadata ?? null,
      })
      .returning();

    this.logger.log(
      `Added incident timeline event: ${event.type} for incident=${incidentId}`,
    );

    if (!eventRow) {
      throw new Error("Failed to create timeline event");
    }

    return eventRow;
  }

  async getTimeline(
    orgId: string,
    projectId: string,
    incidentId: string,
  ): Promise<TimelineEventRecord[]> {
    const events = await db
      .select()
      .from(incidentTimelineEvents)
      .where(
        and(
          eq(incidentTimelineEvents.orgId, orgId),
          eq(incidentTimelineEvents.projectId, projectId),
          eq(incidentTimelineEvents.incidentId, incidentId),
        ),
      )
      .orderBy(desc(incidentTimelineEvents.createdAt));

    return events;
  }

  async getOwnershipHistory(
    orgId: string,
    projectId: string,
    incidentId: string,
  ): Promise<any[]> {
    const history = await db
      .select({
        ownerId: incidentTimelineEvents.actorId,
        ownerName: incidentTimelineEvents.actorName,
        message: incidentTimelineEvents.message,
        createdAt: incidentTimelineEvents.createdAt,
      })
      .from(incidentTimelineEvents)
      .where(
        and(
          eq(incidentTimelineEvents.orgId, orgId),
          eq(incidentTimelineEvents.projectId, projectId),
          eq(incidentTimelineEvents.incidentId, incidentId),
          sql`${incidentTimelineEvents.type} = 'ownership_transfer'`,
        ),
      )
      .orderBy(incidentTimelineEvents.createdAt);

    return history;
  }

  async getCurrentOwner(
    orgId: string,
    projectId: string,
    incidentId: string,
  ): Promise<
    | { ownerId: string; ownerName: string; assignedAt: Date }
    | undefined
  > {
    const [ownership] = await db
      .select({
        ownerId: incidentTimelineEvents.actorId,
        ownerName: incidentTimelineEvents.actorName,
        createdAt: incidentTimelineEvents.createdAt,
      })
      .from(incidentTimelineEvents)
      .where(
        and(
          eq(incidentTimelineEvents.orgId, orgId),
          eq(incidentTimelineEvents.projectId, projectId),
          eq(incidentTimelineEvents.incidentId, incidentId),
          sql`${incidentTimelineEvents.type} = 'ownership_transfer'`,
        ),
      )
      .orderBy(desc(incidentTimelineEvents.createdAt))
      .limit(1);

    if (!ownership) return undefined;

    return {
      ownerId: ownership.ownerId ?? "",
      ownerName: ownership.ownerName ?? "",
      assignedAt: ownership.createdAt,
    };
  }
}
