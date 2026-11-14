import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../common/db";
import { auditLogs } from "../../../common/db/schema";
import { recordAuditEvent } from "../../../common/audit-logs";
import { OrganizationsService } from "./organizations.service";
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "./dto";
import {
  CurrentUser,
  AuthUser,
} from "../../../common/decorators/current-user.decorator";
import {
  CurrentMember,
  MemberContext,
} from "../../../common/decorators/current-member.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";

const auditLogListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createInvitationSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["member", "admin"]).optional().default("member"),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["member", "admin"]),
});

const transferSchema = z.object({
  memberId: z.string().min(1).max(100),
});

const updateMemberProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(
    @CurrentUser() user: AuthUser | null,
    @Headers("authorization") authorization: string | undefined,
    @Body({ schema: CreateOrganizationDto }) body: CreateOrganizationInput,
    @Req() req: Request,
  ) {
    if (!user) throw new UnauthorizedException("Sign in required");
    const input = body;
    const result = await this.organizationsService.createOrganization(
      user.id,
      input,
      authorization,
    );

    await recordAuditEvent({
      userId: user.id,
      organizationId: result?.organization?.id,
      action: "organization.create",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { name: input.name, slug: input.slug },
    });

    return result;
  }

  @Get()
  async getOrganizationsForUser(
    @CurrentUser() user: AuthUser | null,
    @Headers("authorization") authorization: string | undefined,
  ) {
    if (!user) throw new UnauthorizedException("Sign in required");
    return this.organizationsService.getOrganizationsForUser(authorization);
  }
}

@UseGuards(TenantGuard)
@Controller("organization/:organizationId")
export class OrganizationController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async getOrganizationById(
    @Param("organizationId") organizationId: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    return this.organizationsService.getOrganizationById(organizationId);
  }

  @Put()
  async updateOrganization(
    @Param("organizationId") organizationId: string,
    @Body({ schema: UpdateOrganizationDto })
    body: UpdateOrganizationInput,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    const input = body;
    const result = await this.organizationsService.updateOrganization(
      organizationId,
      input,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "organization.update",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: input,
    });

    return result;
  }

  @Delete()
  async deleteOrganization(
    @Param("organizationId") organizationId: string,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Only owners can delete organizations");
    }
    const result =
      await this.organizationsService.deleteOrganization(organizationId);

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "organization.delete",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return result;
  }

  @Get("members")
  async getMembersOfOrganization(
    @Param("organizationId") organizationId: string,
    @Headers("authorization") authorization: string | undefined,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    return this.organizationsService.getMembersOfOrganization(
      organizationId,
      authorization,
    );
  }

  @Post("members")
  async addMemberToOrganization(
    @Param("organizationId") organizationId: string,
    @Body() body: { userId: string; role?: string },
    @Headers("authorization") authorization: string | undefined,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Only owners and admins can add members");
    }
    const result = await this.organizationsService.addMemberToOrganization(
      organizationId,
      body.userId,
      body.role,
      authorization,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "member.create",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { targetUserId: body.userId, role: body.role },
    });

    return result;
  }

  @Delete("members/:userId")
  async removeMemberFromOrganization(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
    @Headers("authorization") authorization: string | undefined,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Only owners and admins can remove members");
    }
    const result = await this.organizationsService.removeMemberFromOrganization(
      organizationId,
      userId,
      authorization,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "member.delete",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { targetUserId: userId },
    });

    return result;
  }

  @Post("invitations")
  async createInvitation(
    @Param("organizationId") organizationId: string,
    @Body({ schema: createInvitationSchema })
    body: z.output<typeof createInvitationSchema>,
    @Headers("authorization") authorization: string | undefined,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Only owners and admins can invite members");
    }
    const result = await this.organizationsService.createInvitation(
      organizationId,
      body.email,
      body.role,
      authorization,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "invitation.create",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { email: body.email, role: body.role },
    });

    return result;
  }

  @Get("invitations")
  async listInvitations(
    @Param("organizationId") organizationId: string,
    @Headers("authorization") authorization: string | undefined,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Only owners and admins can view invitations");
    }
    return this.organizationsService.listInvitations(
      organizationId,
      authorization,
    );
  }

  @Delete("invitations/:invitationId")
  async cancelInvitation(
    @Param("organizationId") organizationId: string,
    @Param("invitationId") invitationId: string,
    @Headers("authorization") authorization: string | undefined,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Only owners and admins can cancel invitations");
    }
    const result = await this.organizationsService.cancelInvitation(
      organizationId,
      invitationId,
      authorization,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "invitation.cancel",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { invitationId },
    });

    return result;
  }

  @Put("members/:memberId/role")
  async updateMemberRole(
    @Param("organizationId") organizationId: string,
    @Param("memberId") memberId: string,
    @Body({ schema: updateMemberRoleSchema })
    body: z.output<typeof updateMemberRoleSchema>,
    @Headers("authorization") authorization: string | undefined,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Only owners and admins can change roles");
    }
    const result = await this.organizationsService.updateMemberRole(
      organizationId,
      memberId,
      body.role,
      authorization,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "member.role_update",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { memberId, role: body.role },
    });

    return result;
  }

  @Patch("member-profile")
  async updateMemberProfile(
    @Param("organizationId") organizationId: string,
    @Body({ schema: updateMemberProfileSchema })
    body: z.output<typeof updateMemberProfileSchema>,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    const result = await this.organizationsService.updateMemberProfile(
      organizationId,
      member.userId,
      body.name,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "member.profile_update",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { fields: ["name"] },
    });

    return result;
  }

  @Post("transfer")
  async transferOrganization(
    @Param("organizationId") organizationId: string,
    @Body({ schema: transferSchema })
    body: z.output<typeof transferSchema>,
    @Headers("authorization") authorization: string | undefined,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Only the owner can transfer the organization");
    }
    const result = await this.organizationsService.transferOrganization(
      organizationId,
      member.userId,
      body.memberId,
      authorization,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "organization.transfer",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { memberId: body.memberId },
    });

    return result;
  }

  @Get("audit-logs")
  async getAuditLogs(
    @Param("organizationId") organizationId: string,
    @CurrentMember() member: MemberContext,
    @Query({ schema: auditLogListSchema })
    query: z.output<typeof auditLogListSchema>,
  ) {
    this.assertOrganization(member, organizationId);
    const { limit, offset } = query;
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  private assertOrganization(
    member: MemberContext,
    organizationId: string,
  ): void {
    if (member.orgId !== organizationId) {
      throw new ForbiddenException(
        "Organization context does not match the resource",
      );
    }
  }
}
