import { Injectable, Logger } from "@nestjs/common";
import { db } from "../../../../common/db";
import { incidentOwnership } from "../../../../common/db/schema";
import { eq, desc, and } from "drizzle-orm";

type OwnershipRecord = typeof incidentOwnership.$inferSelect;

interface OnCallSchedule {
  id: string;
  name: string;
  orgId: string;
  projectId?: string;
  teamId?: string;
  members: OnCallMember[];
  currentIndex: number;
  startedAt: Date;
  endsAt?: Date;
}

interface OnCallMember {
  userId: string;
  userName: string;
  role?: string;
  startedAt: Date;
  endsAt?: Date;
}

@Injectable()
export class OnCallService {
  private readonly logger = new Logger(OnCallService.name);

  async createSchedule(
    orgId: string,
    projectId: string,
    name: string,
    memberIds: string[],
    memberNames: string[],
  ): Promise<OnCallSchedule> {
    const scheduleId = `schedule-${Date.now()}`;

    const members: OnCallMember[] = memberIds.map((uid, i) => ({
      userId: uid,
      userName: memberNames[i] || `Member ${i + 1}`,
      startedAt: new Date(),
    }));

    for (const member of members) {
      await db.insert(incidentOwnership).values({
        orgId,
        projectId,
        incidentId: `oncall-${scheduleId}`,
        ownerId: member.userId,
        ownerName: member.userName,
        assignedBy: "system",
        assignedByName: "System",
      });
    }

    const schedule: OnCallSchedule = {
      id: scheduleId,
      name,
      orgId,
      projectId,
      members,
      currentIndex: 0,
      startedAt: new Date(),
    };

    this.logger.log(
      `Created on-call schedule=${scheduleId} with ${members.length} members`,
    );

    return schedule;
  }

  async getCurrentOnCall(
    orgId: string,
    projectId: string,
    incidentId?: string,
  ): Promise<OwnershipRecord | undefined> {
    const [ownership] = await db
      .select()
      .from(incidentOwnership)
      .where(
        and(
          eq(incidentOwnership.orgId, orgId),
          eq(incidentOwnership.projectId, projectId),
        ),
      )
      .orderBy(desc(incidentOwnership.assignedAt));

    if (!ownership) {
      this.logger.warn(
        `No on-call ownership found for org=${orgId}, project=${projectId}`,
      );
    }

    return ownership;
  }

  async escalate(
    orgId: string,
    projectId: string,
    currentOwnerId: string,
  ): Promise<{ newOwner: OwnershipRecord; previousOwner: OwnershipRecord }> {
    const [current] = await db
      .select()
      .from(incidentOwnership)
      .where(
        and(
          eq(incidentOwnership.orgId, orgId),
          eq(incidentOwnership.projectId, projectId),
          eq(incidentOwnership.ownerId, currentOwnerId),
        ),
      )
      .orderBy(desc(incidentOwnership.assignedAt));

    if (!current) {
      throw new Error(
        `Current owner ${currentOwnerId} not found in ownership records`,
      );
    }

    const allOwnership = await db
      .select()
      .from(incidentOwnership)
      .where(
        and(
          eq(incidentOwnership.orgId, orgId),
          eq(incidentOwnership.projectId, projectId),
        ),
      );

    const memberIds = allOwnership
      .filter((o) => o.ownerId !== currentOwnerId)
      .map((o) => o.ownerId);

    if (memberIds.length === 0) {
      throw new Error("No other on-call members available for escalation");
    }

    const nextIndex = memberIds.indexOf(currentOwnerId) + 1;
    const nextOwnerId =
      nextIndex < memberIds.length ? memberIds[nextIndex]! : memberIds[0]!;

    const [newOwner] = await db
      .select()
      .from(incidentOwnership)
      .where(
        and(
          eq(incidentOwnership.orgId, orgId),
          eq(incidentOwnership.projectId, projectId),
          eq(incidentOwnership.ownerId, nextOwnerId),
        ),
      )
      .orderBy(desc(incidentOwnership.assignedAt))
      .limit(1);

    if (!newOwner) {
      throw new Error(`Next owner ${nextOwnerId} not found`);
    }

    await db.insert(incidentOwnership).values({
      orgId,
      projectId,
      incidentId: current.incidentId,
      ownerId: nextOwnerId,
      ownerName: newOwner?.ownerName || `Member ${nextOwnerId}`,
      assignedBy: "escalation-service",
      assignedByName: "On-Call Escalation Service",
    });

    this.logger.log(
      `Escalated on-call from ${currentOwnerId} to ${nextOwnerId} for project=${projectId}`,
    );

    return {
      newOwner,
      previousOwner: current,
    };
  }

  async handoff(
    orgId: string,
    projectId: string,
    fromUserId: string,
    toUserId: string,
    reason: string,
  ): Promise<OwnershipRecord> {
    const [ownership] = await db
      .insert(incidentOwnership)
      .values({
        orgId,
        projectId,
        incidentId: `handoff-${Date.now()}`,
        ownerId: toUserId,
        ownerName: fromUserId,
        assignedBy: "handoff",
        assignedByName: "On-Call Handoff",
      })
      .returning();

    if (!ownership) {
      throw new Error("Failed to create handoff ownership record");
    }

    this.logger.log(
      `On-call handoff from ${fromUserId} to ${toUserId} for project=${projectId}: ${reason}`,
    );

    return ownership;
  }
}
