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

/**
 * On-Call Rotation Service
 * manages team-based on-call schedules with rotation and escalation
 */
@Injectable()
export class OnCallService {
  private readonly logger = new Logger(OnCallService.name);

  /**
   * Create a new on-call schedule for a team or project.
   */
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

    // Insert ownership records for each member as initial assignment
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

  /**
   * Get the current on-call member for a project/organization.
   * Uses round-robin rotation based on incident timestamps.
   */
  async getCurrentOnCall(
    orgId: string,
    projectId: string,
    incidentId?: string,
  ): Promise<OwnershipRecord | undefined> {
    // Query the most recent ownership assignment for this project
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

  /**
   * Escalate to the next on-call member in the rotation.
   * Returns the new on-call assignee.
   */
  async escalate(
    orgId: string,
    projectId: string,
    currentOwnerId: string,
  ): Promise<{ newOwner: OwnershipRecord; previousOwner: OwnershipRecord }> {
    // Get current ownership record
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

    // Get all members assigned to this project/organization
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

    // Select next member (simple round-robin: first available after current)
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

    // Record the escalation
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

  /**
   * Handoff on-call responsibility to a specific user.
   */
  async handoff(
    orgId: string,
    projectId: string,
    fromUserId: string,
    toUserId: string,
    reason: string,
  ): Promise<OwnershipRecord> {
    // Create new ownership record for the handoff
    const [ownership] = await db
      .insert(incidentOwnership)
      .values({
        orgId,
        projectId,
        incidentId: `handoff-${Date.now()}`,
        ownerId: toUserId,
        ownerName: fromUserId, // We'll need user lookup
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
