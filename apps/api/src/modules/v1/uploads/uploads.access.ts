import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";

export interface UploadAccessActor {
  userId: string;
  role: string;
}

export interface MemberLookup {
  findById(memberId: string): Promise<{ id: string; userId: string } | null>;
  findByUser(userId: string): Promise<{ id: string; userId: string } | null>;
}

/**
 * Decides the object a caller may upload to, or throws. `lookup` isolates the
 * members-table reads so the decision logic is unit-testable without a DB.
 */
export async function resolveUploadTarget(
  kind: "user_avatar" | "member_avatar" | "organization_logo",
  orgId: string,
  actor: UploadAccessActor,
  requestedTargetId: string | undefined,
  lookup: MemberLookup,
): Promise<string> {
  switch (kind) {
    case "organization_logo": {
      if (actor.role !== "owner" && actor.role !== "admin") {
        throw new ForbiddenException(
          "Only owners and admins can set the organization logo",
        );
      }
      return orgId;
    }
    case "user_avatar": {
      if (requestedTargetId && requestedTargetId !== actor.userId) {
        throw new ForbiddenException("You can only upload your own avatar");
      }
      return actor.userId;
    }
    case "member_avatar": {
      const target = requestedTargetId
        ? await lookup.findById(requestedTargetId)
        : await lookup.findByUser(actor.userId);
      if (!target) {
        throw new NotFoundException(
          requestedTargetId
            ? "Member not found in this organization"
            : "You are not a member of this organization",
        );
      }
      const isSelf = target.userId === actor.userId;
      const isAdmin = actor.role === "owner" || actor.role === "admin";
      if (!isSelf && !isAdmin) {
        throw new ForbiddenException(
          "Only the member or an admin can upload this avatar",
        );
      }
      return target.id;
    }
  }
}

export function assertSizeAndType(
  declared: { sizeBytes: number | null; mimeType: string },
  actual: { sizeBytes: number; contentType: string },
): string | null {
  if (declared.sizeBytes !== null && actual.sizeBytes !== declared.sizeBytes) {
    return "the uploaded object does not have the declared size";
  }
  if (actual.contentType !== declared.mimeType) {
    return "the uploaded object does not have the declared content type";
  }
  return null;
}
